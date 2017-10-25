var MongoClient = require('mongodb').MongoClient;
var wait = require("wait.for");

// Connection URL
var url = 'mongodb://localhost:3001/meteor';

var getSchema = function() {
	var db = wait.forMethod(MongoClient, "connect", url);
	console.log("Connected successfully to server");

	var l = db.listCollections();
	var collectionInfos = wait.forMethod(l, "toArray");

	var schema = {};
	var collections = {};

	var findRelatedCollection = function(value, field) {

		for(var collectionName in collections) {

			var related = wait.forMethod(collections[collectionName].collection, "findOne", { _id: value });
			if(related) {
				field["foreignKey"] = true;
				field["references"] = collectionName;
			} else {
				field["key"] = true;
			}
		}
	};

	var getDocSchema = function(doc, docSchema) {
		for(var key in doc) {
			if(!docSchema[key]) {
				docSchema[key] = { "types": {} };
			}

			var typeName = typeof doc[key];
			if(typeName === "object") {
				typeName = Object.prototype.toString.call(doc[key]);
			}

			if(!docSchema[key]["types"][typeName]) {
				docSchema[key]["types"][typeName] = { frequency: 0 };
			}
			docSchema[key]["types"][typeName]["frequency"]++;


			if(typeName == "string" && /^[23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz]{17}$/.test(doc[key])) {
				if(key == "_id") {
					docSchema[key]["primaryKey"] = true;
				} else {
					findRelatedCollection(doc[key], docSchema[key]);
				}
			}

			if(typeName == "[object Object]") {
				docSchema[key]["types"][typeName]["structure"] = {};
				getDocSchema(doc[key], docSchema[key]["types"][typeName]["structure"]);
			}
		}
	};

	var mostFrequentType = function(docSchema, processed) {
		if(processed) {
			for(var fieldName in docSchema) {
				if(docSchema[fieldName]) {
					var max = 0;
					var notNull = true;
					for(var typeName in docSchema[fieldName]["types"]) {
						if(typeName == "[object Null]") {
							notNull = false;									
						}
						docSchema[fieldName]["types"][typeName]["frequency"] = docSchema[fieldName]["types"][typeName]["frequency"] / processed;
						if(docSchema[fieldName]["types"][typeName]["frequency"] > max) {
							max = docSchema[fieldName]["types"][typeName]["frequency"];
							if(typeName != "undefined" && typeName != "[object Null]") {
								docSchema[fieldName]["type"] = typeName;
							}
						}
					}
					if(!docSchema[fieldName]["type"]) {
						docSchema[fieldName]["type"] = "undefined";
						notNull = false;
					}

					var dataType = docSchema[fieldName]["type"];
					if(dataType == "[object Object]") {
						mostFrequentType(docSchema[fieldName]["types"][dataType]["structure"], processed);
						docSchema[fieldName]["structure"] = docSchema[fieldName]["types"][dataType]["structure"];
					}
					delete docSchema[fieldName]["types"];

					docSchema[fieldName]["required"] = notNull;
				}
			}
		}
	};

	collectionInfos.map(function(collectionInfo, index) {
		var docSchema = {};
		schema[collectionInfo.name] = docSchema;

		var collectionData = {};
		collections[collectionInfo.name] = collectionData;
		collectionData["collection"] = db.collection(collectionInfo.name);

		var cur = wait.forMethod(collectionData["collection"], "find", {}, { limit: 100 });
		var docs = wait.forMethod(cur, "toArray");
		docs.map(function(doc) {
			getDocSchema(doc, docSchema);
		});

		mostFrequentType(docSchema, docs.length);
	});

	db.close();
	return schema;
};


var x = function() {
	var schema = getSchema();
	console.log(JSON.stringify(schema, null, 4));
};

wait.launchFiber(x);
