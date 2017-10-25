#! /usr/bin/env node

const commandLineArgs = require("command-line-args");
const fs = require("fs");
const path = require("path");
const replaceExt = require("replace-ext");
const extractMongoSchema = require("./extract-mongo-schema");

const optionDefinitions = [
  { name: "database", alias: "d", type: String },
  { name: "output", alias: "o", type: String }
];

const args = commandLineArgs(optionDefinitions);

console.log("");
console.log("Extract schema from Mongo database (including foreign keys)");

var printUsage = function() {
	console.log("");
	console.log("Usage:");
	console.log("\textract-mongo-schema -d connection_string -o schema.json");
	console.log("\t\t-d, --database\tDatabase connection string. Example: \"mongodb://localhost:3001/meteor\".");
	console.log("\t\t-o, --output\tOutput file");
	console.log("");
	console.log("Enjoy! (and expect bugs)");
	console.log("");
};

if(!args.database) {
	console.log("Database connection string is missing.");
	printUsage();
	process.exit(1);
}

if(!args.output) {
	console.log("Output path is missing.");
	printUsage();
	process.exit(1);
}

if(fs.existsSync(args.output)) {
	var outputStat = fs.lstatSync(args.output);

	if(outputStat.isDirectory()) {
		console.log("Error: output \"" + args.output + "\" is not a file.");
		process.exit(1);
	}
}

console.log("");
console.log("Extracting...");
extractMongoSchema.extractMongoSchema(args.database, function(err, schema) {
	if(err) {
		console.log(err);
		process.exit(1);
	}
	try {
		fs.writeFileSync(args.output, JSON.stringify(schema, null, "\t"), "utf8");
	} catch(e) {
		console.log("Error: cannot write output \"" + args.output + "\". " + e.message);
		process.exit(1);
	}

	console.log("Success.");
	console.log("");
});
