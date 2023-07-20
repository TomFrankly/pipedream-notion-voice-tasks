import { Configuration, OpenAIApi } from "openai";
import { encode } from "gpt-3-encoder";
import Joi from "joi";
import validator from "validator";
import dayjs from "dayjs";
import emojiRegex from "emoji-regex";
import { jsonrepair } from "jsonrepair";
import axios from "axios";
import retry from "async-retry";

const config = {
	maxtokens: 2000,
	model: "",
	system_messages: {
		user_name: "",
		async round_1() {
			const hard_coded = `You are a task separator. Your separate user input into a JSON array of task strings. Do not rewrite user input. Just separate it, looking for words like "and", commas, or distinct sentences as separators.

			Keep due date references with their original task.
			
			Examples:
			
			Input: I need to prepare slides for Wednesday's team meeting by tomorrow.
			
			Output: ["I need to prepare slides for Wednesday's team meeting by tomorrow."]
			
			Input: Today I need to schedule a dentist appointment, and Carl needs to pick up materials for the e-commerce project by tomorrow at 5pm. Also, Linda must finish her report for the sustainability project by next Monday, and I have to prepare for the Wednesday team meeting. Don't forget, Paul needs to order new computers for the IT upgrade project by this Friday.
			
			["Today I need to schedule a dentist appointment", "Carl needs to pick up materials for the e-commerce project by tomorrow at 5pm", "Linda must finish her report for the sustainability project by next Monday", "I have to prepare for the Wednesday team meeting", "Paul needs to order new computers for the IT upgrade project by this Friday."]
			
			You only write JSON. Do not write text that isn't valid JSON.`;

			if (this.remote !== null && this.remote?.round_1 !== undefined) {
				return this.remote.round_1.replace("'{user_name}'", this.user_name);
			} else {
				return hard_coded;
			}
		},
		async round_2() {
			const hard_coded = `Your are a task analyzer. Your job is to analyze an array of tasks, and for each task, set a due_date_confidence property with a value of either Low or High.

			Return a valid JSON array of task objects, each with task_name and due_date_confidence. task_name should be the exact text of the entire task for each element.
			
			due_date_confidence should default to Low.
			
			In order for due_date_confidence to be high, any date-language in the task must by adjescent to language that indicates the task must be done by that date.
			
			If a task merely references the date of an event, that is not indicative of a due date. The date language must refer to the date by which the task itself has to be done.
			
			Example: "Buy an outfit for the Friday meeting" would have low due_date_confidence.
			
			Examples of tasks with low "due_date_confidence":
			[
			  "Prepare slides for my Friday presentation.",
			  "Buy groceries for the Saturday family get-together.",
			  "Review notes for next Tuesday's meeeting.",
			  "Get an outfit ready for the Wednesday party.",
			  "Organize materials for the Monday workshop."
			]
			
			Examples of tasks with low "due_date_confidence":
			[
			  "Prepare slides for my Friday presentation by Wednesday.",
			  "Buy groceries for the family get-together before Thursday.",
			  "Review notes by Monday evening for the solar car project.",
				"Next Friday I need to take the dog to the vet.",
			  "Get an outfit ready for the party by Tuesday afternoon.",
			  "Organize materials for the workshop, due Sunday at 8pm.",
			  "Today I need to sweep out the garage",
			]
			
			Full example:
			
			User input:
			["I need to buy a cake for the Tuesday party.", "Tony needs to buy a new light for the studio redesign project", "Tomorrow I need to clean out my car for Friday's inspection.", "Marissa must order a sunglasses repair kit by next Tuesday", "I have to repair my mouse due June 30", "Next tuesday I need to make an animation for the Vidcon project", "I must drink 8 gallons of coffee for Friday's big party"]
			
			Your expected output:
			[
			  {
				"task_name": "I need to buy a cake for the Tuesday party.",
				"due_date_confidence": "Low"
			  },
			  {
				"task_name": "Tony needs to buy a new light for the studio redesign project",
				"due_date_confidence": "Low"
			  },
			  {
				"task_name": "Tomorrow I need to clean out my car for Friday's inspection.",
				"due_date_confidence": "High"
			  },
			  {
				"task_name": "Marissa must order a sunglasses repair kit by next Tuesday",
				"due_date_confidence": "High"
			  },
			  {
				"task_name": "I have to repair my mouse due June 30",
				"due_date_confidence": "High"
			  },
			  {
				"task_name": "Next tuesday I need to make an animation for the Vidcon project",
				"due_date_confidence": "High"
			  },
			  {
				"task_name": "I must drink 8 gallons of coffee for Friday's big party",
				"due_date_confidence": "Low"
			  }
			]
			
			You only write JSON. Do not write text that isn't JSON.`;

			if (this.remote !== null && this.remote?.round_2 !== undefined) {
				return this.remote.round_2.replace("'{user_name}'", this.user_name);
			} else {
				return hard_coded;
			}
		},
		async round_3() {
			const hard_coded = `As a task parser, convert task objects from natural language to JSON. Extract task name, due date (if due_date_confidence is 'High' or 'Medium'), assignee, and if contains_project is present, project from each task. Omit missing details.
			Key points:
			"project" is separate. If contains_project is present, extract as "project: <PROJECT_#>", omit "project". Exclude if absent.
			Keep task and project name separate. If a project exists, exclude it from task_name.
			Use ISO 8601 for dates. If due_date_confidence is 'High' or 'Medium', extract the date and do not include it in task_name. If no due date, exclude it. Always consider the context of date-related words. If there is a date-related word that isn't indicating a due date, keep it in task_name.
			Set assignee for each task. Use "${this.user_name}" for self-assignments.
			Capitalize the first word of the task name.
			In the full_task_details property, include the full task details, including the project name, assignee, and due date. This is the original task string.
			Example:

			Input:
			Today is 2023-06-12T21:00:00-06:00.
			[
			{
			"task_text": "Today I need to book a Friday dinner date with Anna",
			"due_date_confidence": "High"
			},
			{
			"task_text": "Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm",
			"due_date_confidence": "High",
			"contains_project": "Contains Project"
			}
			]

			Output:

			[
			{
			"task_name": "Book a Friday dinner date with Anna",
			"due_date": "2023-06-12",
			"assignee": "${this.user_name}",
			"full_task_details","Today I need to book a Friday dinner date with anna"
			},
			{
			"task_name": "Track the guitars",
			"due_date": "2023-06-13T17:00:00-06:00",
			"assignee": "Carl",
			"project": "Breaking Benjamin tribute",
			"full_task_details","Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm"
			}
			]

			Critical: You only write JSON. Do not write text that isn't JSON.`;

			if (this.remote !== null && this.remote?.round_3 !== undefined) {
				return this.remote.round_3.replace("'{user_name}'", this.user_name);
			} else {
				return hard_coded;
			}
		},
		async gpt4_system() {
			const hard_coded = `As a task parser, convert task objects from natural language to JSON. Extract task name, due date, assignee, and project from each task (if the word "project" is present). Omit missing details.
			Key points:
			"project" is separate. If contains_project is present, extract as "project: <PROJECT_#>", omit "project". Exclude if absent.
			Keep task and project name separate. If a project exists, exclude it from task_name.
			Use ISO 8601 for dates. If you set a due date, do not include it in task_name. If no due date, exclude it. Always consider the context of date-related words. If there is a date-related word that isn't indicating a due date, keep it in task_name.
			Set assignee for each task. Use "${this.user_name}" for self-assignments.
			Capitalize the first word of the task name.
			In the full_task_details property, include the full task details, including the project name, assignee, and due date. This is the original task string.
			Example:

			Input:
			Today is 2023-06-12T21:00:00-06:00.
			[
			{
			"task_text": "Today I need to book a Friday dinner date with Anna",
			"due_date_confidence": "High"
			},
			{
			"task_text": "Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm",
			"due_date_confidence": "High",
			"contains_project": "Contains Project"
			}
			]

			Output:

			[
			{
			"task_name": "Book a Friday dinner date with Anna",
			"due_date": "2023-06-12",
			"assignee": "${this.user_name}",
			"full_task_details","Today I need to book a Friday dinner date with anna"
			},
			{
			"task_name": "Track the guitars",
			"due_date": "2023-06-13T17:00:00-06:00",
			"assignee": "Carl",
			"project": "Breaking Benjamin tribute",
			"full_task_details","Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm"
			}
			]

			Critical: You only write JSON. Do not write text that isn't JSON.`;

			if (this.remote !== null && this.remote?.gpt_4 !== undefined) {
				return this.remote.gpt_4.replace("'{user_name}'", this.user_name);
			} else {
				return hard_coded;
			}
		},
	},
};

export default defineComponent({
	props: {
		openai: {
			type: "app",
			app: "openai",
			description: `**Need help with this workflow? Check out the documentation here: https://thomasjfrank.com**\n\nMore automations you may find useful:\n* [Send Voice Note Transcriptions and Summaries to Notion](https://thomasjfrank.com/how-to-transcribe-audio-to-text-with-chatgpt-and-notion/)`
		},
		secretKey: {
			type: "string",
			label: "Secret Key",
			description:
				`Set a secret key here that matches the secret key from your iOS/Android shortcut exactly.\n\nWhen you workflow receives a new request, the secret key in the request body will be compared against this value. If they match, the workflow will continue.\n\nThis prevents others from sending requests to your workflow, even in the rare event that they knew your request URL.\n\n**Example:** if your secret key in your shortcut is "welcometocostco", set "welcometocostco" here.`,
			reloadProps: true,
		},
	},
	async additionalProps() {
		let results;

		// Create a switchover date, after which we default to the stable model name for 3.5
		const currentDate = new Date();
		const switchDate = new Date("2023-07-10");

		if (this.openai) {
			// Initialize OpenAI
			const configuration = new Configuration({
				apiKey: this.openai.$auth.api_key,
			});

			const openai = new OpenAIApi(configuration);
			const response = await openai.listModels();

			results = response.data.data.filter(
				(model) =>
					model.id.includes("gpt") &&
					!model.id.endsWith("0301") &&
					!model.id.endsWith("0314")
			);
		}

		const props = {
			...(this.openai && {
				chat_model: {
					type: "string",
					label: "ChatGPT Model",
					description: `Select the model you would like to use.\n\nDefaults to ${
						currentDate < switchDate ? "gpt-3.5-turbo-0613" : "gpt-3.5-turbo"
					}, which is recommended for this workflow. You can also use gpt-4 if your account has access, though it will increase the average cost by ~7.5x.\n\n**Note:** Subscribing to ChatGPT Plus does not automatically grant gpt-4 API access. [You can join the gpt-4 API waitlist here](https://openai.com/waitlist/gpt-4-api).`,
					default:
						currentDate < switchDate ? "gpt-3.5-turbo-0613" : "gpt-3.5-turbo",
					options: results.map((model) => ({
						label: model.id,
						value: model.id,
					})),
					optional: true,
				},
			}),
			...(this.openai && {
				update_system: {
					type: "boolean",
					label: "Auto-Update System Message",
					description:
						"Set to **True** if you want the your workflow to fetch the latest versions of the system messages (instructions for ChatGPT).\n\nSystem messages tell the model how to behave and how to handle the user's prompt.\n\nThis setting allows for using updated system messages in the event that better ones are discovered or bugs are discovered in the hard-coded ones (without you having to recreate the entire workflow).\n\n[You can read the system messages here](https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/).\n\nIf this is set to **False**, or if the request to that URL fails/takes more than 2 seconds, the script will fall back to the system message that are hard-coded into this workflow. **Defaults to True.**",
					optional: true,
					default: true,
				},
			}),
		};

		return props;
	},
	methods: {
		validateUserInput(data) {
			// Check the secret key to ensure the request came from the correct sender
			if (!data.secret || data.secret !== this.secretKey) {
				throw new Error("Request secret key is incorrect.");
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
				throw new Error("Invalid date format.", dateObject);
			}

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
				throw new Error("Invalid data: " + error.message);
			}

			// If there is no error, return the validated data
			return value;
		},
		async parseTaskWithGPT(
			inputJSON,
			configuration,
			systemMessage,
			round,
			chatMessage
		) {
			let roundNum;
			// Convert the round number if needed
			if (typeof round === "number") {
				roundNum = round.toString();
			} else {
				roundNum = round;
			}

			// Construct the task prompt with the date for relative due-date setting, and set the name
			const rounds = {
				1: inputJSON.task, // Just parse the tasks string into an array of separate tasks
				2: chatMessage, // Parse the tasks array to set due_date_confidence
				3: `Today is ${inputJSON.date}. ${chatMessage}`, // Now do the full parsing
			};

			// Set the max number of tokens a task can contain
			const maxTokens = config.maxtokens;

			// Initialize the openai object
			const openai = new OpenAIApi(configuration);

			// Check the number of tokens in the task
			const tokens = encode(rounds[roundNum]);
			if (tokens.length > maxTokens) {
				throw new Error(
					`Task is too long. Max tokens: ${maxTokens}. Task tokens: ${tokens.length}`
				);
			}

			// Send the task prompt and system message to OpenAI
			return retry(
				async (bail, number) => {
					console.log(`Attempt number ${number} to send prompt to OpenAI.`);
					try {
						const response = await openai.createChatCompletion({
							model: config.model,
							messages: [
								{ role: "system", content: systemMessage },
								{
									role: "user",
									content: rounds[roundNum],
								},
							],
							temperature: 0,
						});

						// Return the response
						return response;
					} catch (error) {
						console.error(`An error occurred: ${error.message}`);
						if (error.response) {
							console.error(`Response status: ${error.response.status}`);
							console.error(
								`Response data: ${JSON.stringify(error.response.data)}`
							);
						}

						// If it's not a 5xx error, don't retry
						if (
							!error.response ||
							error.response.status < 500 ||
							error.response.status >= 600
						) {
							bail(error);
						}

						// If it's a 5xx error, throw it again to trigger a retry
						throw error;
					}
				},
				{
					retries: 2,
					minTimeout: 1000,
					factor: 2,
				}
			);
		},
		calculateGPTCost(usage, model) {
			if (
				!usage ||
				typeof usage !== "object" ||
				!usage.prompt_tokens ||
				!usage.completion_tokens
			) {
				throw new Error("Invalid usage object");
			}

			if (!model || typeof model !== "string") {
				throw new Error("Invalid model string");
			}

			const rates = {
				"gpt-3.5-turbo": {
					prompt: 0.0015,
					completion: 0.002,
				},
				"gpt-3.5-turbo-16k": {
					prompt: 0.003,
					completion: 0.004,
				},
				"gpt-4": {
					prompt: 0.03,
					completion: 0.06,
				},
				"gpt-4-32k": {
					prompt: 0.06,
					completion: 0.12,
				},
			};

			const chatModel = model.includes("gpt-4-32")
				? "gpt-4-32k"
				: model.includes("gpt-4")
				? "gpt-4"
				: model.includes("gpt-3.5-turbo-16k")
				? "gpt-3.5-turbo-16k"
				: "gpt-3.5-turbo";

			if (!rates[chatModel]) {
				throw new Error("Non-supported model.");
			}

			const costs = {
				prompt: (usage.prompt_tokens / 1000) * rates[chatModel].prompt,
				completion:
					(usage.completion_tokens / 1000) * rates[chatModel].completion,
				get total() {
					return this.prompt + this.completion;
				},
			};

			return costs.total;
		},
		validateChatGPTResponse(response) {
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
					const repairedJSON = this.repairJSON(responseArrayString);
					responseArray = JSON.parse(repairedJSON);
				} catch {
					// If the response is not valid JSON after repair, throw an error
					throw new Error("Invalid JSON response from ChatGPT.");
				}
			}

			// Return the response array
			console.log("Response Array has a type of: " + typeof responseArray);
			console.log("Response Array:");
			console.log(responseArray);
			return responseArray;
		},
		repairJSON(input) {
			/** Strip non-JSON text from the response, then run jsonrepair.
			 * Typically, not needed since ChatGPT has always returned valid JSON since
			 * I added an example to the system instructions, but I'm including
			 * it as an insurance policy.
			 * */

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
				throw new Error("No JSON object or array found.");
			}

			// Extract the JSON string from any non-JSON text sandwiching it, then run it through jsonrepair to fix any errors
			const JSONString = jsonrepair(
				input.substring(beginningIndex, endingIndex + 1)
			);

			// Return the repaired JSON string
			return JSONString;
		},
		refineTasks(tasks) {
			console.log("Refining final response...");
			for (let task of tasks) {
				if (task.project) {
					console.log("Project for this task is " + task.project);
				}

				// Remove "project" and "for the X project" from task name and project name
				const taskNameRegex = /\sfor\s.*?project$/gi;
				const projectNameRegex = /\sproject$/i;

				if (taskNameRegex.test(task.task_name)) {
					task.task_name = task.task_name.replace(taskNameRegex, "");
				}

				if (task.project && projectNameRegex.test(task.project)) {
					console.log("Current project name: " + task.project);
					task.project = task.project.replace(projectNameRegex, "");
				}

				if (task.project) {
					// Capitlize the first letter of the project name
					if (task.project.charAt(0) === task.project.charAt(0).toLowerCase()) {
						task.project =
							task.project.charAt(0).toUpperCase() + task.project.slice(1);
					}
				}
			}

			return tasks;
		},
		detectProjects(taskArray) {
			const taskObjectArray = [];

			for (let task of taskArray) {
				const taskObject = {
					task_text: task.task_name,
					due_date_confidence: task.due_date_confidence,
					...(task.task_name.includes("project") && {
						contains_project: "Contains Project",
					}),
				};
				taskObjectArray.push(taskObject);
			}

			return taskObjectArray;
		},
		async fetchPrompts() {
			if (
				typeof this.update_system === "boolean" &&
				this.update_system === false
			) {
				console.log("System messages update disabled.");
				config.system_messages.remote = null;
			} else {
				try {
					const response = await axios.get(
						"https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/",
						{ timeout: 2000 }
					);
					config.system_messages.remote = response.data.en;
					console.log("System messages fetched successfully.");
				} catch (error) {
					console.log("System messages fetch failed.");
					console.error(error);
					// If the fetch fails, set the config system messages to null so the round methods will default to their hard-coded prompts
					config.system_messages.remote = null;
				}
			}
		},
		async moderationCheck(message, configuration) {
			if (!message) {
				throw new Error("Message cannot be empty or null.");
			}
			
			// Initialize the openai object
			const openai = new OpenAIApi(configuration);

			return retry(
				async (bail, number) => {
					console.log(`Moderation attempt number: ${number}`);
					try {
						const response = await openai.createModeration({
							input: message,
						});

						const flagged = response.data.results[0].flagged;

						if (flagged === undefined || flagged === null) {
							throw new Error(
								"Moderation check failed. Request to OpenAI's Moderation endpoint could not be completed."
							);
						}

						if (flagged === true) {
							console.log("Detected inappropriate content in the prompt.");
							return $.flow.exit();
						} else {
							console.log("Prompt passed moderation check.");
						}
					} catch (error) {
						console.error(`An error occurred: ${error.message}`);
						if (error.response) {
							console.error(`Response status: ${error.response.status}`);
							console.error(
								`Response data: ${JSON.stringify(error.response.data)}`
							);
						}

						if (
							!error.response ||
							error.response.status < 500 ||
							error.response.status >= 600
						) {
							bail(error);
						}

						throw error;
					}
				},
				{
					retries: 2,
					minTimeout: 1000,
					factor: 2,
				}
			);
		},
	},
	async run({ steps, $ }) {
		// Start the workflow timer
		const startDate = new Date(steps.trigger.context.ts);
		const startTimestamp = startDate.getTime();

		// Set the model if the user chose one, or set the default to gpt-3.5-turbo
		if (this.chat_model) {
			config.model = this.chat_model;
		} else {
			config.model = "gpt-3.5-turbo";
		}

		// Validate the user's input
		const validatedBody = this.validateUserInput(steps.trigger.event.body);

		// Initialize OpenAI
		const configuration = new Configuration({
			apiKey: this.openai.$auth.api_key,
		});

		// Run the moderation check
		await this.moderationCheck(JSON.stringify(validatedBody), configuration);

		// Set the user's name
		config.system_messages.user_name = validatedBody.name;

		// Fetch the system messages
		await this.fetchPrompts();

		if (config.model.includes("gpt-4")) {
			console.log("GPT-4 selected. Initiating 1-round task processing.");

			// Send the validated input to ChatGPT
			const gpt4Response = await this.parseTaskWithGPT(
				validatedBody,
				configuration,
				await config.system_messages.gpt4_system(),
				3,
				validatedBody.task
			);

			// Get the cost of the operation
			const gpt4Cost = this.calculateGPTCost(
				gpt4Response.data.usage,
				gpt4Response.data.model
			);

			// Validate the response from GPT-4
			const validatedResponse = this.validateChatGPTResponse(
				gpt4Response.data.choices[0].message.content
			);

			console.log("Response Validated. Validated Response:");
			console.log(validatedResponse);

			// Refine the validated Round 2 response
			const refinedResponse = this.refineTasks(validatedResponse);
			console.log("Response Refined. Refined response: ");
			console.log(refinedResponse);

			// Start storing the results
			const results = {
				start_timestamp: startTimestamp,
				validated_body: validatedBody,
				cost: gpt4Cost,
				model: gpt4Response.data.model,
				validated_response: validatedResponse,
				final_response: refinedResponse,
				full_response: gpt4Response,
			};

			return results;
		} else {
			// Send the validated input to ChatGPT (Round 1)
			const roundOneResponse = await this.parseTaskWithGPT(
				validatedBody,
				configuration,
				await config.system_messages.round_1(),
				1
			);

			// Get the cost of Round 1
			const roundOneCost = this.calculateGPTCost(
				roundOneResponse.data.usage,
				roundOneResponse.data.model
			);

			// Validate the response from ChatGPT (Round 1)
			const validatedResponseOne = this.validateChatGPTResponse(
				roundOneResponse.data.choices[0].message.content
			);

			console.log("Round One Validated. Validated Response:");
			console.log(validatedResponseOne);

			// Send the validated response to ChatGPT (Round 2)
			const roundTwoResponse = await this.parseTaskWithGPT(
				validatedBody,
				configuration,
				await config.system_messages.round_2(),
				2,
				JSON.stringify(validatedResponseOne)
			);

			// Get the cost of Round 2
			const roundTwoCost = this.calculateGPTCost(
				roundTwoResponse.data.usage,
				roundTwoResponse.data.model
			);

			// Validate the response from ChatGPT (Round 2)
			const validatedResponseTwo = this.validateChatGPTResponse(
				roundTwoResponse.data.choices[0].message.content
			);

			console.log("Round Two Validated.");

			// Detect projects from validatedResponseTwo
			const detectedProjects = this.detectProjects(validatedResponseTwo);

			// Send the validated response to ChatGPT (Round 3)
			const roundThreeResponse = await this.parseTaskWithGPT(
				validatedBody,
				configuration,
				await config.system_messages.round_3(),
				3,
				JSON.stringify(detectedProjects)
			);

			// Get the cost of Round 2
			const roundThreeCost = this.calculateGPTCost(
				roundThreeResponse.data.usage,
				roundThreeResponse.data.model
			);

			// Validate the response from ChatGPT (Round 2)
			const validatedResponseThree = this.validateChatGPTResponse(
				roundThreeResponse.data.choices[0].message.content
			);

			console.log("Round Three Validated.");

			// Refine the validated Round 2 response
			const refinedResponseThree = this.refineTasks(validatedResponseThree);
			console.log("Round Three Refined. Refined response: ");
			console.log(refinedResponseThree);

			// Start storing the results
			const results = {
				start_timestamp: startTimestamp,
				validated_body: validatedBody,
				cost: roundOneCost + roundTwoCost + roundThreeCost,
				model: roundOneResponse.data.model,
				validated_response_1: validatedResponseOne,
				validated_response_2: validatedResponseTwo,
				detected_projects_response: detectedProjects,
				validated_response_3: validatedResponseThree,
				final_response: refinedResponseThree,
				full_responses: {
					round_one: roundOneResponse,
					round_two: roundTwoResponse,
					round_three: roundThreeResponse,
				},
			};

			return results;
		}
	},
});
