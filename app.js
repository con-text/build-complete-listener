var fs = require('fs');
var exec = require('child_process').exec;
var zlib = require('zlib');


var config = fs.readFileSync( "config.json" );
	config = JSON.parse(config);
// SQS Wrapper
var easySQS = require('easy-sqs');
var SQSClient = easySQS.CreateClient(config.AWSAccessKey, config.AWSSecretAccessKey, config.AWSRegion);

// DynamoDB Wrapper 
var AWS = require('aws-sdk');
AWS.config.update({ accessKeyId: config.AWSAccessKey, 
					secretAccessKey: config.AWSSecretAccessKey });

var s3 = new AWS.S3({
    apiVersion: '2006-03-01',
    region: config.AWSRegion
});

var sys = require('sys')

function puts(error, stdout, stderr) {
	if(error){
		sys.puts(error);
	}
	if(stdout){
		sys.puts(stdout);
	}
	if(stderr){
		sys.puts(stderr);
	}

}



SQSClient.getQueue("https://sqs.eu-west-1.amazonaws.com/099054743551/buildComplete", function(err, q) {
	var queueReader = q.createQueueReader();
	console.log("got queue");
		 
	queueReader.onReceipt(function (err, messages, context) {


		messages.forEach(function(msg){

			var body = JSON.parse(msg.Body).Records;
			body.forEach(function(m){

				console.log("EVENT:",m.eventName);
				console.log("fileName:",m.s3.object.key);

				var filename = m.s3.object.key;
				var eventtype= m.eventName.split(":")[1].toLowerCase();

				if(eventtype == "put" && filename == "build.zip"){
					console.log("We have an event from TRAVIS wooo", config);

					var params = {Bucket: config.BUCKET, Key: config.BUILDNAME};


					s3.getObject(params, function(err, data){

	
						if(err){
							console.log(err);
						}
						else{
							fs.writeFile("./builds/build.zip", data.Body, function(err){
								if(err){
									console.log(err);
								}
								else{
									//this should be changed to copy/rename later on
									params.Body = data.Body;
									params.Key = "finished/"+params.Key;
									s3.putObject(params, function(err){
										if(err){
											console.log("Error copying the file back over");
										}
										else{
											console.log("Copied");
										}
										exec("cd " + __dirname + "; mkdir builds; cd builds; rm -rf unzipped; mkdir unzipped; unzip build.zip -d ./unzipped;", puts);
										// exec("cd " + __dirname + "/builds; rm -rf unzipped; mkdir unzipped; mv build.zip unzipped/build.zip; cd unzipped; unzip build.zip; mv build.zip ../build.zip;", puts);
										// exec("cd " + __dirname + "/builds; rm -rf unzipped; mkdir unzipped; mv build.zip unzipped/build.zip", function(a,b,c){
										// 	exec("cd " + __dirname + "/builds/unzipped; unzip build.zip;", function(a,b,c){
										// 		exec("cd " + __dirname + "/builds/unzipped; mv build.zip ../build.zip;");
										// 	});
										// });

									});
									
								}
							});
						}

					});
				}
				else{
					// console.log(m);
					// console.log("EVENT type:", eventtype);
				}


			});
			context.deleteMessage(msg);

		});

	});


	queueReader.start();
});
