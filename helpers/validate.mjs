import Joi from "joi";
import validator from "validator";
import emojiRegex from "emoji-regex";
import dayjs from "dayjs";
import { jsonrepair } from "jsonrepair";

export default {
    methods: {
        async validateUserInput(data) {
			// Check the secret key to ensure the request came from the correct sender
			if (!data.secret || data.secret !== this.secretKey) {
				const error = new Error(
					"Secret key in the request does not match the key configured in the workflow settings. The secret key used in this request was: " +
						data.secret
				);
				await this.createFallbackTask(error, true, "config");
			}

			// Define the Joi schema for each property in the data
			const scheme = Joi.object({
				task: Joi.string()
					.custom((value, helpers) => {
						const alphanumeric = new RegExp(
							"^[a-zA-Z0-9À-ÖØ-öø-ÿ.,!?;$'\"&#:“”’\\-–— ]*$"
						);
						if (!alphanumeric.test(value) && !emojiRegex().test(value)) {
							return helpers.message(
								"Task must only contain letters, numbers, emoji, and punctuation."
							);
						}
						return value;
					})
					.required(),
				name: Joi.string()
					.max(50)
					.message("Name must be 50 characters or less.")
					.required(),
				date: Joi.string()
					.custom((value, helpers) => {
						const iso8601Regex =
							/(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?([+-]([01]\d|2[0-3]):[0-5]\d|Z)?)/;
						if (!iso8601Regex.test(value)) {
							return helpers.message(
								"Date must be a string in ISO 8601 format."
							);
						}
						return value;
					})
					.message("Date must be a string in ISO 8601 format.")
					.required(),
			});

			// Construct the date object and check its validity
			const dateObject = validator.escape(data.date);
			if (!dayjs(dateObject).isValid()) {
				const error = new Error(
					`Invalid date format. Date object currently is formatted as: ${dateObject}. Please use ISO 8601 format.`
				);
				await this.createFallbackTask(error, true, "chatgpt");
			}

			// Strip any newlines out of the task body
			data.task = data.task.replace(/\n/g, " ");

			// Construct the data object
			const dataObject = {
				task: validator.escape(data.task),
				name: validator.escape(data.name),
				date: dateObject,
			};

			console.log("Date before Joi: " + dataObject.date);

			// Validate the data against the schema
			const { error, value } = scheme.validate(dataObject);

			// If there is an error, return the error message
			if (error) {
				const joiError = new Error(`Joi error: ${error}`);
				await this.createFallbackTask(joiError, true, "chatgpt");
			}

			// Log the value
			console.log("Validated Joi Object");
			console.log(value);

			// If there is no error, return the validated data
			return value;
		},
        async validateChatGPTResponse(response) {
			const responseArrayString = response;

			// Check if the response if valid JSON
			let responseArray;
			try {
				responseArray = JSON.parse(responseArrayString);
				console.log("Response Array is valid JSON.");
			} catch {
				// If the response is not valid JSON, attempt to repair it
				try {
					console.log("Attempting JSON repair...");
					const repairedJSON = await this.repairJSON(responseArrayString);
					responseArray = JSON.parse(repairedJSON);
				} catch {
					// If the response is not valid JSON after repair, throw an error
					const error = new Error("Invalid JSON response from ChatGPT.");
					await this.createFallbackTask(error, true, "chatgpt");
				}
			}

			// Return the response array
			console.log("Response Array has a type of: " + typeof responseArray);
			console.log("Response Array:");
			console.log(responseArray);
			return responseArray;
		},
        async repairJSON(input) {
			// Find the first { or [ and the last } or ]
			const beginningIndex = Math.min(
				input.indexOf("{") !== -1 ? input.indexOf("{") : Infinity,
				input.indexOf("[") !== -1 ? input.indexOf("[") : Infinity
			);
			const endingIndex = Math.max(
				input.lastIndexOf("}") !== -1 ? input.lastIndexOf("}") : -Infinity,
				input.lastIndexOf("]") !== -1 ? input.lastIndexOf("]") : -Infinity
			);

			// If no JSON object or array is found, throw an error
			if (beginningIndex == Infinity || endingIndex == -1) {
				const error = new Error(
					"No JSON object or array found (in repairJSON)."
				);
				await this.createFallbackTask(error, true, "chatgpt");
			}

			try {
				// Extract the JSON string from any non-JSON text sandwiching it, then run it through jsonrepair to fix any errors
				const JSONString = jsonrepair(
					input.substring(beginningIndex, endingIndex + 1)
				);

				// Return the repaired JSON string
				return JSONString;
			} catch (error) {
				const jsonRepairError = new Error(`JSON repair error: ${error}`);
				await this.createFallbackTask(jsonRepairError, true, "chatgpt");
			}
		}
    }
}