# Extract Mongo Schema

Extract (and visualize) schema from Mongo database, including foreign keys. Output is simple json file or html with dagre/d3.js diagram (depending on command line options).

## Installation

```sh
npm -g install extract-mongo-schema
```

## Usage

```sh

Usage:
	extract-mongo-schema -d connection_string -o schema.json -f json
		-u, --authSource		Database for authentication. Example: "admin".
		-d, --database			Database connection string. Example: "mongodb://localhost:3001/meteor".
		-o, --output			Output file
		-f, --format			Output file format. Can be "json", "html-diagram" or "xlsx". Default is "json".
		-i, --inputJson 		Input JSON file, to be used instead of --database. NOTE: this will ignore the remainder of input params and use a previously generated JSON file to generate the diagram.
		-c, --collection		Comma separated list of collections to analyze. Example: "collection1,collection2".
		-a, --array			Comma separated list of types of arrays to analyze. Example: "Uint8Array,ArrayBuffer,Array".
		-r, --raw			Shows the exact list of types with frequency instead of the most frequent type only.
		-l, --limit			Number of records to parse to get the schema, default is 100.
		-n, --dont-follow-fk		Don't follow specified foreign key. Can be simply "fieldName" (all collections) or "collectionName:fieldName" (only for given collection).
		-s, --include-system string	Analyzes system collections as well.

```

## Example usage

**Extract schema into json**

```
extract-mongo-schema -d "mongodb://localhost:3001/meteor" -o schema.json
```


**Extract schema into html**

```
extract-mongo-schema -d "mongodb://localhost:3001/meteor" -o schema.html -f html-diagram
```

**Extract schema into xlsx**

```
extract-mongo-schema -d "mongodb://localhost:3001/meteor" -o schema.xlsx -f xlsx
```

**Convert json to html**

```
extract-mongo-schema -i schema.json -o schema.html -f html-diagram
```

**Extract specific collections in raw format and analyze Array items**

```
extract-mongo-schema -d "mongodb://localhost:3001/meteor" -o schema.json -c "collection1,collection2,collection3" -a "Array" -r
```

Open html in your browser and you'll see rendered ER diagram.


**Ignore some foreign keys**

Use `-n` switch to prevent detecting and drawing links for specified fields. You can specify simply `fieldName` (that applies to all collections) or `collectionName:fieldName` (foreign key is ignored only in given collection).

Example:

```
extract-mongo-schema -d "mongodb://localhost:3001/meteor" -o schema.html -f html-diagram -n createdBy -n users:modifiedBy
```
*(in this example: any foreign key named "createdBy" will be ignored. Also "modifiedBy" but only in users collection)*


## Example output .html (screenshot)

![Alt text](/preview.png?raw=true "Preview")


## Example output .json

**schema.json**

```json
{
	"customers": {
		"_id": {
			"primaryKey": true,
			"type": "string",
			"required": true
		},
		"name": {
			"type": "string",
			"required": true
		},
		"phone": {
			"type": "string",
			"required": true
		},
		"email": {
			"type": "string",
			"required": true
		},
		"note": {
			"type": "string",
			"required": true
		},
		"createdAt": {
			"type": "Date",
			"required": true
		},
		"createdBy": {
			"key": true,
			"type": "string",
			"required": true
		},
		"modifiedAt": {
			"type": "Date",
			"required": true
		},
		"modifiedBy": {
			"key": true,
			"type": "string",
			"required": true
		},
		"ownerId": {
			"key": true,
			"type": "string",
			"required": true
		}
	},
	"invoices": {
		"_id": {
			"primaryKey": true,
			"type": "string",
			"required": true
		},
		"invoiceNumber": {
			"type": "string",
			"required": true
		},
		"date": {
			"type": "Date",
			"required": true
		},
		"customerId": {
			"foreignKey": true,
			"references": "customers",
			"key": true,
			"type": "string",
			"required": true
		},
		"createdAt": {
			"type": "Date",
			"required": true
		},
		"createdBy": {
			"key": true,
			"type": "string",
			"required": true
		},
		"modifiedAt": {
			"type": "Date",
			"required": true
		},
		"modifiedBy": {
			"key": true,
			"type": "string",
			"required": true
		},
		"ownerId": {
			"key": true,
			"type": "string",
			"required": true
		},
		"totalAmount": {
			"type": "number",
			"required": true
		}
	},
	"users": {
		"_id": {
			"primaryKey": true,
			"type": "string",
			"required": true
		},
		"createdAt": {
			"type": "Date",
			"required": true
		},
		"services": {
			"type": "Object",
			"structure": {
				"password": {
					"type": "Object",
					"structure": {
						"bcrypt": {
							"type": "string",
							"required": true
						}
					},
					"required": true
				},
				"resume": {
					"type": "Object",
					"structure": {
						"loginTokens": {
							"type": "Array",
							"required": true
						}
					},
					"required": true
				}
			},
			"required": true
		},
		"emails": {
			"type": "Array",
			"required": true
		},
		"roles": {
			"type": "Array",
			"required": true
		},
		"profile": {
			"type": "Object",
			"structure": {
				"name": {
					"type": "string",
					"required": true
				},
				"email": {
					"type": "string",
					"required": true
				},
				"facebook": {
					"type": "string",
					"required": true
				},
				"google": {
					"type": "string",
					"required": true
				},
				"twitter": {
					"type": "string",
					"required": true
				},
				"website": {
					"type": "string",
					"required": true
				}
			},
			"required": true
		}
	},
	"meteor_accounts_loginServiceConfiguration": {},
	"invoice_items": {
		"_id": {
			"primaryKey": true,
			"type": "string",
			"required": true
		},
		"description": {
			"type": "string",
			"required": true
		},
		"quantity": {
			"type": "number",
			"required": true
		},
		"price": {
			"type": "number",
			"required": true
		},
		"invoiceId": {
			"key": true,
			"foreignKey": true,
			"references": "invoices",
			"type": "string",
			"required": true
		},
		"createdAt": {
			"type": "Date",
			"required": true
		},
		"createdBy": {
			"key": true,
			"foreignKey": true,
			"references": "users",
			"type": "string",
			"required": true
		},
		"modifiedAt": {
			"type": "Date",
			"required": true
		},
		"modifiedBy": {
			"key": true,
			"foreignKey": true,
			"references": "users",
			"type": "string",
			"required": true
		},
		"ownerId": {
			"key": true,
			"foreignKey": true,
			"references": "users",
			"type": "string",
			"required": true
		},
		"amount": {
			"type": "number",
			"required": true
		}
	}
}
```


That's all folks.
Enjoy! :)
