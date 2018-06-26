var MongoClient = require("mongodb").MongoClient;
var wait = require("wait.for");

var getSchema = function(url, opts) {
	var db = wait.forMethod(MongoClient, "connect", url);

	var l = db.listCollections();
	var collectionInfos = wait.forMethod(l, "toArray");
	var schema = {};
	var collections = {};

	var findRelatedCollection = function(value, field) {
		for(var collectionName in collections) {
			var related = wait.forMethod(collections[collectionName].collection, "findOne", { _id: value });
			if(related) {
				delete field["key"];
				field["foreignKey"] = true;
				field["references"] = collectionName;
			} else {
				field["key"] = true;
			}
		}
	};

	var getDocSchema = function(collectionName, doc, docSchema) {
		for(var key in doc) {
			if(!docSchema[key]) {
				docSchema[key] = { "types": {} };
			}

			if(!docSchema[key]["types"]) {
				docSchema[key]["types"] = {};
			}

			var typeName = typeof doc[key];
			if(typeName === "object") {
				typeName = Object.prototype.toString.call(doc[key]);
			}

			typeName = typeName.replace("[object ", "");
			typeName = typeName.replace("]", "");

			if(!docSchema[key]["types"][typeName]) {
				docSchema[key]["types"][typeName] = { frequency: 0 };
			}
			docSchema[key]["types"][typeName]["frequency"]++;

			if(typeName == "string" && /^[23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz]{17}$/.test(doc[key])) {
				if(key == "_id") {
					docSchema[key]["primaryKey"] = true;
				} else {
					// only if is not already processes
					if(!docSchema[key]["foreignKey"] || !docSchema[key]["references"]) {
						// only if is not ignored
						if(!(opts.dontFollowFK["__ANY__"][key] || (opts.dontFollowFK[collectionName] && opts.dontFollowFK[collectionName][key]))) {
							findRelatedCollection(doc[key], docSchema[key]);
						}
					}
				}
			}

			if(typeName == "Object") {
				docSchema[key]["types"][typeName]["structure"] = {};
				getDocSchema(collectionName, doc[key], docSchema[key]["types"][typeName]["structure"]);
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
						if(typeName == "Null") {
							notNull = false;									
						}
						docSchema[fieldName]["types"][typeName]["frequency"] = docSchema[fieldName]["types"][typeName]["frequency"] / processed;
						if(docSchema[fieldName]["types"][typeName]["frequency"] > max) {
							max = docSchema[fieldName]["types"][typeName]["frequency"];
							if(typeName != "undefined" && typeName != "Null") {
								docSchema[fieldName]["type"] = typeName;
							}
						}
					}
					if(!docSchema[fieldName]["type"]) {
						docSchema[fieldName]["type"] = "undefined";
						notNull = false;
					}

					var dataType = docSchema[fieldName]["type"];
					if(dataType == "Object") {
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
		var collectionData = {};
		collections[collectionInfo.name] = collectionData;
		collectionData["collection"] = db.collection(collectionInfo.name);
	});

	collectionInfos.map(function(collectionInfo, index) {
		collectionData = collections[collectionInfo.name];
		var docSchema = {};
		schema[collectionInfo.name] = docSchema;
		var cur = wait.forMethod(collectionData["collection"], "find", {}, { limit: 100 });
		var docs = wait.forMethod(cur, "toArray");
		docs.map(function(doc) {
			getDocSchema(collectionInfo.name, doc, docSchema);
		});

		mostFrequentType(docSchema, docs.length);
	});

	db.close();
	return schema;
};


var printSchema = function(url, opts, cb) {
	var schema = null;
	try {
		var schema = getSchema(url, opts);
	} catch(err) {
		if(cb) {
			cb(err, null);
		} else {
			console.log(err);
		}
		return;	
	}

	if(cb) {
		cb(null, schema);
	}

	return schema;
};

var extractMongoSchema = function(url, opts, cb) {
	wait.launchFiber(printSchema, url, opts, cb);
};


if(typeof module != "undefined" && module.exports) {
  module.exports.extractMongoSchema = extractMongoSchema;
} else {
	this.extractMongoSchema = extractMongoSchema;
}
