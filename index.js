var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

// Connection URL
var url = 'mongodb://localhost:3001/meteor';




var getSchema = function(cb) {
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);
		console.log("Connected successfully to server");


		db.listCollections().toArray().then(function(collectionInfos) {

			var schema = {};
			var collections = {};

			collectionInfos.map(function(collectionInfo, index) {
				schema[collectionInfo.name] = { ___processed: 0 };
				collections[collectionInfo.name] = {};
				collections[collectionInfo.name]["collection"] = db.collection(collectionInfo.name);

				collections[collectionInfo.name]["collection"].find({}, { limit: 100 }).toArray().then(function(docs) {
					schema[collectionInfo.name]["___processed"] = docs.length;
					docs.map(function(doc) {
						for(var key in doc) {
							if(!schema[collectionInfo.name][key]) {
								schema[collectionInfo.name][key] = { types: {} };
							}

							var typeName = typeof doc[key];
							if(typeName === "object") {
								typeName = Object.prototype.toString.call(doc[key]);
							}
							schema[collectionInfo.name][key]["types"][typeName] = schema[collectionInfo.name][key]["types"][typeName] ? schema[collectionInfo.name][key]["types"][typeName] + 1 : 1;
						}
					});

					var processed = schema[collectionInfo.name]["___processed"] || 0;
					if(processed) {
						for(var fieldName in schema[collectionInfo.name]) {
							if(schema[collectionInfo.name][fieldName]) {
								var max = 0;

								for(var typeName in schema[collectionInfo.name][fieldName]["types"]) {
									schema[collectionInfo.name][fieldName]["types"][typeName] = schema[collectionInfo.name][fieldName]["types"][typeName] / processed;
									if(schema[collectionInfo.name][fieldName]["types"][typeName] > max) {
										max = schema[collectionInfo.name][fieldName]["types"][typeName];
										if(typeName != "undefined" && typeName != "[object Null]") {
											schema[collectionInfo.name][fieldName]["type"] = typeName;
										}
									}
								}

							}
						}
					}
					delete schema[collectionInfo.name].___processed;

					if(index + 1 == collectionInfos.length) {
						db.close();
						if(cb) {
							cb(schema);
						}
					}

				});
			});
		});
	});
};


getSchema(function(schema) {
	console.log(JSON.stringify(schema, null, 4));
});