import { Client } from "@notionhq/client";
import Bottleneck from "bottleneck";
import Fuse from "fuse.js";
import OpenAI from "openai";
import { encode } from "gpt-3-encoder";
import Joi from "joi";
import validator from "validator";
import dayjs from "dayjs";
import emojiRegex from "emoji-regex";
import { jsonrepair } from "jsonrepair";
import axios from "axios";
import retry from "async-retry";

const config = {
	notion_dbs: {
		tasks: {
			id: "",
		},
		projects: {
			id: "",
		},
	},
	default_workflow_source: "",
	maxtokens: 500,
	model: "",
	system_messages: {
		user_name: "",
		async round_1() {
			const hard_coded = `You are a task separator. Your separate user input into a JSON array of task strings. Do not rewrite user input. Just separate it, looking for words like \"and\", commas, or distinct sentences as separators.\n\nKeep due date references with their original task.\n\nExamples:\n\nInput: I need to prepare slides for Wednesday\'s team meeting by tomorrow.\n\nOutput: [\"I need to prepare slides for Wednesday\'s team meeting by tomorrow.\"]\n\nInput: Today I need to schedule a dentist appointment, and Carl needs to pick up materials for the e-commerce project by tomorrow at 5pm. Also, Linda must finish her report for the sustainability project by next Monday, and I have to prepare for the Wednesday team meeting. Don\'t forget, Paul needs to order new computers for the IT upgrade project by this Friday.\n\n[\"Today I need to schedule a dentist appointment\", \"Carl needs to pick up materials for the e-commerce project by tomorrow at 5pm\", \"Linda must finish her report for the sustainability project by next Monday\", \"I have to prepare for the Wednesday team meeting\", \"Paul needs to order new computers for the IT upgrade project by this Friday.\"]\n\nYou only write JSON. Do not write text that isn\'t valid JSON.`;

			if (this.remote !== null && this.remote?.round_1 !== undefined) {
				return this.remote.round_1.replace("'{user_name}'", this.user_name);
			} else {
				return hard_coded;
			}
		},
		async round_2() {
			const hard_coded = `Your are a task analyzer. Your job is to analyze an array of tasks, and for each task, set a due_date_confidence property with a value of either Low or High.\n\nReturn a valid JSON array of task objects, each with task_name and due_date_confidence. task_name should be the exact text of the entire task for each element.\n\ndue_date_confidence should default to Low.\n\nIn order for due_date_confidence to be high, any date-language in the task must by adjescent to language that indicates the task must be done by that date.\n\nIf a task merely references the date of an event, that is not indicative of a due date. The date language must refer to the date by which the task itself has to be done.\n\nExample: \"Buy an outfit for the Friday meeting\" would have low due_date_confidence.\n\nExamples of tasks with low \"due_date_confidence\":\n[\n  \"Prepare slides for my Friday presentation.\",\n  \"Buy groceries for the Saturday family get-together.\",\n  \"Review notes for next Tuesday\'s meeeting.\",\n  \"Get an outfit ready for the Wednesday party.\",\n  \"Organize materials for the Monday workshop.\"\n]\n\nExamples of tasks with low \"due_date_confidence\":\n[\n  \"Prepare slides for my Friday presentation by Wednesday.\",\n  \"Buy groceries for the family get-together before Thursday.\",\n  \"Review notes by Monday evening for the solar car project.\",\n\"Next Friday I need to take the dog to the vet.\",\n  \"Get an outfit ready for the party by Tuesday afternoon.\",\n  \"Organize materials for the workshop, due Sunday at 8pm.\",\n  \"Today I need to sweep out the garage\",\n]\n\nFull example:\n\nUser input:\n[\"I need to buy a cake for the Tuesday party.\", \"Tony needs to buy a new light for the studio redesign project\", \"Tomorrow I need to clean out my car for Friday\'s inspection.\", \"Marissa must order a sunglasses repair kit by next Tuesday\", \"I have to repair my mouse due June 30\", \"Next tuesday I need to make an animation for the Vidcon project\", \"I must drink 8 gallons of coffee for Friday\'s big party\"]\n\nYour expected output:\n[\n  {\n\"task_name\": \"I need to buy a cake for the Tuesday party.\",\n\"due_date_confidence\": \"Low\"\n  },\n  {\n\"task_name\": \"Tony needs to buy a new light for the studio redesign project\",\n\"due_date_confidence\": \"Low\"\n  },\n  {\n\"task_name\": \"Tomorrow I need to clean out my car for Friday\'s inspection.\",\n\"due_date_confidence\": \"High\"\n  },\n  {\n\"task_name\": \"Marissa must order a sunglasses repair kit by next Tuesday\",\n\"due_date_confidence\": \"High\"\n  },\n  {\n\"task_name\": \"I have to repair my mouse due June 30\",\n\"due_date_confidence\": \"High\"\n  },\n  {\n\"task_name\": \"Next tuesday I need to make an animation for the Vidcon project\",\n\"due_date_confidence\": \"High\"\n  },\n  {\n\"task_name\": \"I must drink 8 gallons of coffee for Friday\'s big party\",\n\"due_date_confidence\": \"Low\"\n  }\n]\n\nYou only write JSON. Do not write text that isn\'t JSON.`;

			if (this.remote !== null && this.remote?.round_2 !== undefined) {
				return this.remote.round_2.replace("'{user_name}'", this.user_name);
			} else {
				return hard_coded;
			}
		},
		async round_3() {
			const hard_coded = `As a task parser, convert task objects from natural language to JSON. Extract task name, due date (if due_date_confidence is \'High\' or \'Medium\'), assignee, and if contains_project is present, project from each task. Omit missing details.\nKey points:\n\"project\" is separate. If contains_project is present, extract as \"project: <PROJECT_#>\", omit \"project\". Exclude if absent.\nKeep task and project name separate. If a project exists, exclude it from task_name.\nUse ISO 8601 for dates. If due_date_confidence is \'High\' or \'Medium\', extract the date and do not include it in task_name. If no due date, exclude it. Always consider the context of date-related words. If there is a date-related word that isn\'t indicating a due date, keep it in task_name.\nSet assignee for each task. Use \"${this.user_name}\" for self-assignments.\nCapitalize the first word of the task name.\nIn the full_task_details property, include the full task details, including the project name, assignee, and due date. This is the original task string.\nExample:\n\nInput:\nToday is 2023-06-12T21:00:00-06:00.\n[\n{\n\"task_text\": \"Today I need to book a Friday dinner date with Anna\",\n\"due_date_confidence\": \"High\"\n},\n{\n\"task_text\": \"Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm\",\n\"due_date_confidence\": \"High\",\n\"contains_project\": \"Contains Project\"\n}\n]\n\nOutput:\n\n[\n{\n\"task_name\": \"Book a Friday dinner date with Anna\",\n\"due_date\": \"2023-06-12\",\n\"assignee\": \"${this.user_name}\",\n\"full_task_details\",\"Today I need to book a Friday dinner date with anna\"\n},\n{\n\"task_name\": \"Track the guitars\",\n\"due_date\": \"2023-06-13T17:00:00-06:00\",\n\"assignee\": \"Carl\",\n\"project\": \"Breaking Benjamin tribute\",\n\"full_task_details\",\"Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm\"\n}\n]\n\nCritical: You only write JSON. Do not write text that isn\'t JSON.`;

			if (this.remote !== null && this.remote?.round_3 !== undefined) {
				return this.remote.round_3.replace("'{user_name}'", this.user_name);
			} else {
				return hard_coded;
			}
		},
		async gpt4_system() {
			const hard_coded = `As a task parser, convert task objects from natural language to JSON. Extract task name, due date, assignee, and project from each task (if the word \"project\" is present). Omit missing details.\nKey points:\n\"project\" is separate. If contains_project is present, extract as \"project: <PROJECT_#>\", omit \"project\". Exclude if absent.\nKeep task and project name separate. If a project exists, exclude it from task_name.\nUse ISO 8601 for dates. If you set a due date, do not include it in task_name. If no due date, exclude it. Always consider the context of date-related words. If there is a date-related word that isn\'t indicating a due date, keep it in task_name.\nSet assignee for each task. Use \"${this.user_name}\" for self-assignments.\nCapitalize the first word of the task name.\nIn the full_task_details property, include the full task details, including the project name, assignee, and due date. This is the original task string.\nExample:\n\nInput:\nToday is 2023-06-12T21:00:00-06:00.\n[\n{\n\"task_text\": \"Today I need to book a Friday dinner date with Anna\",\n\"due_date_confidence\": \"High\"\n},\n{\n\"task_text\": \"Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm\",\n\"due_date_confidence\": \"High\",\n\"contains_project\": \"Contains Project\"\n}\n]\n\nOutput:\n\n[\n{\n\"task_name\": \"Book a Friday dinner date with Anna\",\n\"due_date\": \"2023-06-12\",\n\"assignee\": \"${this.user_name}\",\n\"full_task_details\",\"Today I need to book a Friday dinner date with anna\"\n},\n{\n\"task_name\": \"Track the guitars\",\n\"due_date\": \"2023-06-13T17:00:00-06:00\",\n\"assignee\": \"Carl\",\n\"project\": \"Breaking Benjamin tribute\",\n\"full_task_details\",\"Carl needs to track the guitars for the Breaking Benjamin tribute project by tomorrow at 5pm\"\n}\n]\n\nCritical: You only write JSON. Do not write text that isn\'t JSON.`;

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
			description: `⬆ Don\'t forget to connect your OpenAI account! I also recommend setting your [OpenAI Hard Limit](https://platform.openai.com/account/billing/limits) to a lower value, such as $10; you likely don't need it to be the default of $120/mo.\n\n## Overview\n\nThis workflow lets you create new tasks in Notion from your phone, **using your voice**. \n\nIt also includes some advanced features:\n\n* You can create multiple tasks in a single voice prompt\n* Relative due dates are supported (e.g. \"by *next Friday*\")\n* You can mention assignees and projects, which the workflow will attempt to intelligently match to existing Notion users and projects\n\n**Need help with this workflow? [Check out the full instructions and FAQ here.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/)**\n\n## Compatibility\n\nThis workflow will work with any Notion database.\n\n### Upgrade Your Notion Experience\n\nWhile this workflow will work with any Notion database, it\'s even better with a template.\n\nFor general productivity use, you\'ll love [Ultimate Brain](https://thomasjfrank.com/brain/) – my all-in-one second brain template for Notion. \n\nUltimate Brain brings tasks, notes, projects, and goals all into one tool. Naturally, it works very well with this workflow.\n\n**Are you a creator?** \n\nMy [Creator\'s Companion](https://thomasjfrank.com/creators-companion/) template includes a ton of features that will help you make better-performing content and optimize your production process. There\'s even a version that includes Ultimate Brain, so you can easily use this workflow to create tasks related to your content.\n\n*P.S. – This free workflow took 3 months to build. If you\'d like to support my work, buying one of my templates is the best way to do so!*\n\n## Instructions\n\n[Click here for the full instructions on setting up this workflow.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#instructions)\n\n### Mobile App Setup\n\nYou can create voice tasks with this workflow on iOS, MacOS, and Android.\n\n* For MacOS and iOS (iPhone, iPad), we\'ll use the **Shortcuts** app. [Click here to access my shared workflow and instructions.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#ios)\n* For Android, we\'ll use the **Tasker** app ($3.49 USD, one-time). [Click here to access my shared workflow and instructions.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#android) *At this time, I know of no free app for Android that can handle this workflow.*\n\nOnce you\'ve set up the workflow on your phone, run it once to send a Test Event to this Pipedream workflow.\n\n*Technically, you can also create tasks via any tool that will let you make an HTTP request with a JSON body. [See the full blog post for instructions on this.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#http-generic)*\n\n## Creating Tasks\n\nWhen creating tasks, you\'ll get the best results when you follow a couple of simple rules:\n\n1. For due dates, say \"by [date]\" or \"due [date]\" at the end your task phrase. *E.G. \"I need to finish planning the team retreat **by Friday**.*\n2. For projects, you must use the word **\"project\"**. *E.G. \"Tony needs to mount the audio foam **for the studio design project** by next Tuesday.*\n\nBeyond that, this workflow is pretty flexible! Note that you can add multiple tasks in a single voice command. Example:\n\n*\"I need to finish my video script by Tuesday and Brian needs to create the environment model in Blender by July 30 and Tony needs to upload the green screen test footage by tomorrow.\"*\n\n## FAQs\n\nBelow you\'ll find links that answer frequently asked questions about this workflow.\n\n* [Cost FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#cost)\n* [Privacy FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#privacy)\n* [Security FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#security)\n* [Code FAQs and GitHub Repo](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#code)\n* [Support FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#support)\n\n## More Resources\n\n**More automations you may find useful:**\n\n* [Send Voice Note Transcriptions and Summaries to Notion](https://thomasjfrank.com/how-to-transcribe-audio-to-text-with-chatgpt-and-notion/)\n* [Notion to Google Calendar Sync](https://thomasjfrank.com/notion-google-calendar-sync/)\n\n**All My Notion Automations:**\n\n* [Notion Automations Hub](https://thomasjfrank.com/notion-automations/)\n\n**Want to get notified about updates to this workflow (and about new Notion templates, automations, and tutorials)?**\n\n* [Join my Notion Tips newsletter](https://thomasjfrank.com/fundamentals/#get-the-newsletter)`,
		},
		notion: {
			type: "app",
			app: "notion",
			description: `Connect your Notion account. When setting up the connection, be sure to grant Pipedream access to your Task and Project databases, or to a page that contains them.`,
		},
		databaseID: {
			type: "string",
			label: "Tasks Database",
			description: "Select your tasks database. *If you don't see your database here, try waiting 1-2 minutes and then refreshing the page. If that doesn't work, [please read this FAQ section](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#missing-database).*",
			async options({ query, prevContext }) {
				if (this.notion) {
					try {
						const notion = new Client({
							auth: this.notion.$auth.oauth_access_token,
						});
			
						let start_cursor = prevContext?.cursor;
			
						const response = await notion.search({
							...(query ? { query } : {}),
							...(start_cursor ? { start_cursor } : {}),
							page_size: 50,
							filter: {
								value: "database",
								property: "object",
							},
							sorts: [
								{
									direction: "descending",
									property: "last_edited_time",
								},
							],
						});
			
						let allTasksDbs = response.results.filter((db) =>
							db.title?.[0]?.plain_text.includes("All Tasks")
						);
						let nonTaskDbs = response.results.filter(
							(db) => !db.title?.[0]?.plain_text.includes("All Tasks")
						);
						let sortedDbs = [...allTasksDbs, ...nonTaskDbs];
						const UTregex = /All Tasks/;
						const UTLabel = " – (used for Ultimate Tasks)";
						const UBregex = /All Tasks \[\w*\]/;
						const UBLabel = " – (used for Ultimate Brain)";
						const options = sortedDbs.map((db) => ({
							label: UBregex.test(db.title?.[0]?.plain_text)
								? db.title?.[0]?.plain_text + UBLabel
								: UTregex.test(db.title?.[0]?.plain_text)
								? db.title?.[0]?.plain_text + UTLabel
								: db.title?.[0]?.plain_text,
							value: db.id,
						}));
			
						return {
							context: {
								cursor: response.next_cursor,
							},
							options,
						};
					} catch (error) {
						console.error(error);
						return {
							context: {
								cursor: null,
							},
							options: [],
						};
					}
				} else {
					return {
						options: ["Please connect your Notion account first."],
					}
				}
			},
		},
		secretKey: {
			type: "string",
			label: "Secret Key [TYPE THIS MANUALLY]",
			description: `**MANUALLY TYPE a secret key** that matches the secret key from your iOS/Android shortcut exactly. *Do NOT use the dropdown to select a path here.*\n\n**Important: This workflow is provided for free, as-is, and without warranty. Use this workflow at your own risk. Make sure to keep your trigger URL (shown in the trigger step above) and this secret key SECRET. Treat both like passwords. I also recommend setting your [OpenAI Hard Limit](https://platform.openai.com/account/billing/limits) to a lower amount, such as $10 (normal use of this workflow costs around $0.003 per run, so your use shoudl never even come close to that).**\n\nAs long as you don't share your trigger URL and secret key with unauthorized people, this workflow is safe to use. [You can read all of the security info here](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#security).\n\n**Here's how this secret key feature works:**\n\nWhen your workflow receives a new request, the secret key in the request body will be compared against the key you have entered here. If they match, the workflow will continue.\n\nThis prevents others from sending requests to your workflow, even in the rare event that they knew your request URL.\n\n**Example:** if your secret key in your mobile app shortcut is "welcometocostco", set "welcometocostco" here.\n\n**Important: Do not share this key, nor your unique trigger URL, with anyone you don't trust.**`,
			secret: true,
			reloadProps: true,
		},
	},
	async additionalProps() {
		let results;

		if (this.openai) {
			try {
				// Initialize OpenAI
				const openai = new OpenAI({
					apiKey: this.openai.$auth.api_key,
				});
				const response = await openai.models.list();

				results = response.data.data.filter(
					(model) =>
						model.id.includes("gpt") &&
						!model.id.endsWith("0301") &&
						!model.id.endsWith("0314")
				);
			} catch (err) {
				console.error(`Encountered an error with OpenAI: ${err} – Please check that your API key is still valid.`);
			}
		}

		if (!this.databaseID) return {}
		
		const notion = new Client({
			auth: this.notion.$auth.oauth_access_token,
		});

		const database = await notion.databases.retrieve({
			database_id: this.databaseID,
		});

		const properties = database.properties;

		// Check for presence of Kanban Status and/or Priority properties
		const kanbanFlag = properties.hasOwnProperty("Kanban Status")
			? true
			: false;
		const priorityFlag = properties.hasOwnProperty("Priority") ? true : false;

		// Check for the presence of Smart List for UB GTD workflows
		const smartListFlag = properties.hasOwnProperty("Smart List")
			? true
			: false;

		// Set the "required" string that will conditionally show only for UB/UT users
		const requiredString = " (REQUIRED for Ultimate Brain/Ultimate Tasks)";

		const titleProps = Object.keys(properties).filter(
			(k) => properties[k].type === "title"
		);
		const dateProps = Object.keys(properties).filter(
			(k) => properties[k].type === "date"
		);
		const personProps = Object.keys(properties).filter(
			(k) => properties[k].type === "people"
		);
		const relationProps = Object.keys(properties).filter(
			(k) => properties[k].type === "relation"
		);
		const selectProps = Object.keys(properties).filter(
			(k) => properties[k].type === "select"
		);
		const statusProps = Object.keys(properties).filter(
			(k) => properties[k].type === "status"
		);

		// If a Project relation is selected, retrieve the correpsonding database and get its properties for filtering
		let projectProperties;
		const projectFilterProps = {};
		if (this.project) {
			const projectsDatabase = await notion.databases.retrieve({
				database_id: properties[this.project].relation.database_id,
			});

			projectProperties = projectsDatabase.properties;

			// Add the Project DB's ID and properties to the config object
			config.notion_dbs.projects.id =
				properties[this.project].relation.database_id;
			config.notion_dbs.projects.properties = projectProperties;

			const supportedFilterProperties = {
				status: ["status", "select"],
				date: ["date", "last_edited_time", "created_time"],
				checkbox: ["checkbox"],
			};

			projectFilterProps.status = Object.keys(projectProperties).filter((k) =>
				supportedFilterProperties.status.includes(projectProperties[k].type)
			);
			projectFilterProps.date = Object.keys(projectProperties).filter((k) =>
				supportedFilterProperties.date.includes(projectProperties[k].type)
			);
			projectFilterProps.checkbox = Object.keys(projectProperties).filter((k) =>
				supportedFilterProperties.checkbox.includes(projectProperties[k].type)
			);
		}

		const props = {
			taskName: {
				type: "string",
				label: "Task Name (Required)",
				description: "Select the title property for your tasks.",
				options: titleProps.map((prop) => ({ label: prop, value: prop })),
				optional: false,
			},
			dueDate: {
				type: "string",
				label: "Due Date",
				description: "Select the date property for your tasks.",
				options: dateProps.map((prop) => ({ label: prop, value: prop })),
				optional: true,
			},
			assignee: {
				type: "string",
				label: "Assignee",
				description: "Select the person property for your tasks.",
				options: personProps.map((prop) => ({ label: prop, value: prop })),
				optional: true,
			},
			project: {
				type: "string",
				label: "Project",
				description: "Select the relation property for your tasks.",
				options: relationProps.map((prop) => ({ label: prop, value: prop })),
				optional: true,
				reloadProps: true,
			},
			status: {
				type: "string",
				label: "Status",
				description: "Select the default status property for your tasks.",
				options: statusProps.map((prop) => ({ label: prop, value: prop })),
				optional: true,
				reloadProps: true,
			},
			source: {
				type: "string",
				label: "Source",
				description:
					"Select the source property for your tasks (must be a Select property). Use this if you want to track how your tasks were created - e.g. \"iOS Voice Shortcut\". Once selected, you'll then be able to set the actual value in the Source Value field below. Note: Even if you don't use this, your Created By property's value (if you have that property in your database) for each task will be Pipedream, meaning you can easily find tasks created through this workflow using that property value.",
				options: selectProps.map((prop) => ({ label: prop, value: prop })),
				optional: true,
				reloadProps: true,
			},
			priority: {
				type: "string", // MUST be able to switch between select and status
				label: `Priority${priorityFlag ? requiredString : ""}`,
				description: `Select the Priority property${
					priorityFlag
						? requiredString
						: ". Typically only used by Ultimate Tasks/Ultimate Brain users."
				}\n\nIf you don't see the Priority Value option come up after selecting a value here, please hit **Refresh Fields** below.`,
				options: selectProps
					.concat(statusProps)
					.map((prop) => ({ label: prop, value: prop })),
				optional: priorityFlag ? false : true,
				reloadProps: true,
			},
			kanban_status: {
				type: "string", // MUST be able to switch between select and status
				label: `Kanban Status${kanbanFlag ? requiredString : ""}`,
				description: `Select the Kanban Status property${
					kanbanFlag
						? requiredString
						: ". Typically only used by Ultimate Tasks/Ultimate Brain users."
				}\n\nIf you don't see the Kanban Status Value option come up after selecting a value here, please hit **Refresh Fields** below.`,
				options: selectProps
					.concat(statusProps)
					.map((prop) => ({ label: prop, value: prop })),
				optional: kanbanFlag ? false : true,
				reloadProps: true,
			},
			advanced_options: {
				type: "boolean",
				label: "Enable Advanced Options",
				description: `Set this to **True** to enable advanced options for this workflow, including Project database filtering, fuzzy search sensitivity, and more.`,
				default: false,
				optional: true,
				reloadProps: true,
			},
			...(selectProps.concat(statusProps).includes("Smart List") && {
				smart_list: {
					type: "string", // MUST be able to switch between select and status
					label: `Smart List`,
					description: `Select your Smart List property. Typically only used by Ultimate Brain users who use the Process (GTD-style) dashboard`,
					options: selectProps
						.concat(statusProps)
						.filter((prop) => prop === "Smart List")
						.map((prop) => ({ label: prop, value: prop })),
					optional: true,
					reloadProps: true,
				},
			}),
			...(this.source && {
				source_value: {
					type: "string",
					label: `Source Value (for chosen propety: ${this.source})`,
					description:
						"Type or select a value for your chosen Source property.",
					options: this.source
						? properties[this.source].select.options.map((option) => ({
								label: option.name,
								value: option.name,
						  }))
						: [],
					default: "iOS Voice Shortcut",
					optional: true,
				},
			}),
			...(this.project && this.advanced_options === true && {
				fuzzy_search_threshold: {
					type: "integer",
					label: "Project-matching Search Score Threshold",
					description: `The projects named in your input are matched against project pages in the Projects database connected to your ${this.project} Relation property. Fuzzy search is used to match the right project, even if you didn't say the name exactly right. You can adjust this value to make the matching more or less strict. A score of 0 will require an exact match; a score of 100 will match the nearest Project, no matter how different it is. The default is 40, which is generally effective. I typically don't recommend setting the score higher, but you can set it lower if you find that your tasks are getting matched to the wrong projects. It's much better for a task to get NO matched Project (and therefore ideally be sent to your Inbox) than for it to be matched with the wrong project.`,
					default: 40,
					optional: true,
				},
				database_filter_status: {
					type: "string",
					label: `Project Status Filter (for chosen Relation: ${this.project})`,
					description:
						'Status or Select property to use as a filter for the Projects database. Once you select a property here, you\'ll get a new field to select the value you want to filter by. For example, you could select a Status-type property here, then select "In Progress" as the value to filter by.',
					options: projectFilterProps?.status?.map((prop) => ({
						label: prop,
						value: prop,
					})),
					optional: true,
					reloadProps: true,
				},
				database_filter_checkbox: {
					type: "string",
					label: `Project Checkbox Filter (for chosen Relation: ${this.project})`,
					description:
						"Checkbox property to use as a filter for the Projects database. Once you select a property here, you'll get a new field to select the value you want to filter by. For example, you could select a Checkbox-type property here, then select true as the value to filter by.",
					options: projectFilterProps?.checkbox?.map((prop) => ({
						label: prop,
						value: prop,
					})),
					optional: true,
					reloadProps: true,
				},
				database_filter_date: {
					type: "string",
					label: `Project Date Filter (for chosen Relation: ${this.project})`,
					description:
						"Date, Created Time, or Last Edited Time property to use as a recency filter for the Projects database. Once you select a property here, you'll get a new field to select a number of days you want to filter by. For example, you could select a Last Edited Time-type property here, then select 7 days as the value to filter by. This would return projects that were last edited within the last 7 days.",
					options: projectFilterProps?.date?.map((prop) => ({
						label: prop,
						value: prop,
					})),
					optional: true,
					reloadProps: true,
				},
			}),
			...(this.status && {
				status_value: {
					type: "string",
					label: `Status Value (for chosen propety: ${this.status})`,
					description:
						"Choose a value for your chosen Status property. If you don't choose a Status property, your database's default value will be used.",
					options: this.status
						? properties[this.status].status.options.map((option) => ({
								label: option.name,
								value: option.name,
						  }))
						: [],
					optional: true,
				},
			}),
			...(this.kanban_status && {
				kanban_status_value: {
					type: "string",
					label: `Kanban Status Value${
						kanbanFlag ? requiredString : ""
					} – (for chosen property: ${this.kanban_status})`,
					description: `Choose a value for your Kanban Status property${
						kanbanFlag ? requiredString + "." : "."
					}`,
					options: this.kanban_status
						? properties[this.kanban_status][
								properties[this.kanban_status]?.type
						  ].options.map((option) => ({
								label: option.name,
								value: option.name,
						  }))
						: [],
					optional: this.kanban_status && kanbanFlag ? false : true,
				},
			}),
			...(this.priority && {
				priority_value: {
					type: "string",
					label: `Priority Value${
						priorityFlag ? requiredString : ""
					} – (for chosen property: ${this.priority})`,
					description: `Choose a value for your Priority property${
						priorityFlag ? requiredString + "." : "."
					}`,
					options: this.priority
						? properties[this.priority][
								properties[this.priority]?.type
						  ].options.map((option) => ({
								label: option.name,
								value: option.name,
						  }))
						: [],
					optional: this.priority && priorityFlag ? false : true,
				},
			}),
			...(this.smart_list && {
				smart_list_value: {
					type: "string",
					label: `Smart List Value (for chosen property: ${this.smart_list})`,
					description: `Choose a value for your Smart List property. If you don't choose one, Smart List will be ignored.`,
					options: this.smart_list
						? properties[this.smart_list][
								properties[this.smart_list]?.type
						  ].options.map((option) => ({
								label: option.name,
								value: option.name,
						  }))
						: [],
					optional: true,
				},
			}),
			...(this.database_filter_status && {
				database_filter_status_value: {
					type: "string[]",
					label: `Projects Database Status/Select Filter Value (chosen property: ${this.database_filter_status})`,
					description:
						'The value(s) to filter by for the Status/Select property. You can select multiple values here (e.g. "In Progress" and "Not Started").',
					options: this.database_filter_status
						? projectProperties[this.database_filter_status][
								projectProperties[this.database_filter_status].type
						  ].options.map((option) => ({
								label: option.name,
								value: option.name,
						  }))
						: [],
					optional: true,
				},
			}),
			...(this.database_filter_checkbox && {
				database_filter_checkbox_value: {
					type: "boolean",
					label: `Projects Database Checkbox Filter Value (chosen property: ${this.database_filter_checkbox})`,
					description: "The value to filter by for the Checkbox property.",
					optional: true,
				},
			}),
			...(this.database_filter_date && {
				database_filter_date_value: {
					type: "integer",
					label: `Projects Database Date Filter Value (chosen property: ${this.database_filter_date})`,
					description:
						"The number of days since today to filter by for the Date, Created Time, or Last Edited Time property. For example, if you select 7 here, the filter will return projects where your selected Date, Created Time, or Last Edited Time property's value is within the last 7 days.",
					optional: true,
				},
			}),
			...(this.openai && {
				chat_model: {
					type: "string",
					label: "ChatGPT Model",
					description: `Select the model you would like to use.\n\nDefaults to **gpt-3.5-turbo**, which is recommended for this workflow. You can also use **gpt-4**, which may allow you to speak more "loosely" while retaining accuracy in task parsing. However, it will also increase the average cost of each workflow run by ~7.5x.`,
					default: "gpt-3.5-turbo",
					options: results.map((model) => ({
						label: model.id,
						value: model.id,
					})),
					optional: true,
				},
			}),
			...(this.openai && this.advanced_options === true && {
				send_response: {
					type: "boolean",
					label: "Send Response on Completion?",
					description: `Set this to **true** if you would like to receive a response on your device when this workflow successfully completes.\n\nThe response will tell you:\n* How many tasks were created\n* How long the operation took\n* How much the operation cost\n\n**Note:** In the case of an error, this workflow will send you an email with both the task details you spoke into your phone and the error details.\n\nFor certain errors, a fallback routine will send a single task to Notion containing everything you said as well.\n\nFor this reason, you can set this to **false** to simply send a generic response right away, which will help the workflow feel faster to use (especially since ChatGPT can often take 20-30 seconds to fully process all operations).`,
					default: false,
					optional: true,
				},
			}),
			...(this.advanced_options === true && {
				remove_midnight: {
					type: "boolean",
					label: "Remove Mightnight (00:00) Due Times",
					description: `Set this to **true** if you would like to remove the due time from tasks that have a due time of midnight (00:00).\n\nThe ChatGPT system instructions have been written so that tasks without a due time should not have one in the due date property, but sometimes ChatGPT ignores this instruction and applies a due time of 00:00.\n\nBy enabling this feature, that 00:00 due time will be stripped out before your task is sent to Notion.`,
					default: false,
					optional: true,
				}
			}),
			...(this.openai && this.advanced_options === true && {
				update_system: {
					type: "string",
					label: "System Message Source",
					description:
						`Set to **Auto-Update** if you want the your workflow to fetch the latest versions of the system messages (instructions for ChatGPT) I've written.\n\nSystem messages tell the model how to behave and how to handle the user's prompt.\n\nThis setting allows for using updated system messages in the event that better ones are discovered or bugs are discovered in the hard-coded ones (without you having to recreate the entire workflow).\n\n[You can read the system messages here](https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/).\n\nIf this is set to **Hard-Coded**, or if the request to that URL fails/takes more than 2 seconds, the script will fall back to the system message that are hard-coded into this workflow.\n\nIf you would like to use your own system messages, select **Write Your Own (Advanced)** and then add your custom URL to the **System Message URL** property below. [Read the full instructions on this use case here.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#custom-system)`,
					options: ["Auto-Update", "Hard-Coded", "Write Your Own (Advanced)"],
					optional: true,
					default: "Auto-Update",
					reloadProps: true,
				},
			}),
			...(this.update_system === "Write Your Own (Advanced)" && {
				system_message_url: {
					type: "string",
					label: "System Message URL",
					description: `The URL where your custom system messages are hosted.\n\n*Writing your own system messages is an advanced use case, is not recommended for most users, and will not be supported in any way. If you do write your own system messages, you should [copy mine](https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/) and make minor adjustments.The system messages must be a JSON object with a particular structure, and large changes will likely break this workflow.*`,
					optional: true,
					default: "https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/",
				}
			})
		};

		return props;
	},
	methods: {
		/* ChatGPT-specific methods */
		async chatGTPHandler(steps) {
			/* This method handles all ChatGPT operations, calling other methods as needed. */
			
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
			const validatedBody = await this.validateUserInput(steps.trigger.event.body);

			// Run the moderation check
			await this.moderationCheck(JSON.stringify(validatedBody));

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
				const gpt4Cost = await this.calculateGPTCost(
					gpt4Response.data.usage,
					gpt4Response.data.model
				);

				// Validate the response from GPT-4
				const validatedResponse = await this.validateChatGPTResponse(
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
				const roundOneCost = await this.calculateGPTCost(
					roundOneResponse.data.usage,
					roundOneResponse.data.model
				);

				// Validate the response from ChatGPT (Round 1)
				const validatedResponseOne = await this.validateChatGPTResponse(
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
				const roundTwoCost = await this.calculateGPTCost(
					roundTwoResponse.data.usage,
					roundTwoResponse.data.model
				);

				// Validate the response from ChatGPT (Round 2)
				const validatedResponseTwo = await this.validateChatGPTResponse(
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
				const roundThreeCost = await this.calculateGPTCost(
					roundThreeResponse.data.usage,
					roundThreeResponse.data.model
				);

				// Validate the response from ChatGPT (Round 2)
				const validatedResponseThree = await this.validateChatGPTResponse(
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
		async validateUserInput(data) {
			// Check the secret key to ensure the request came from the correct sender
			if (!data.secret || data.secret !== this.secretKey) {
				const error = new Error("Secret key in the request does not match the key configured in the workflow settings. The secret key used in this request was: " + data.secret);
				await this.createFallbackTask(error, true, "config")
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
				const error = new Error(`Invalid date format. Date object currently is formatted as: ${dateObject}. Please use ISO 8601 format.`);
				await this.createFallbackTask(error, true, "chatgpt")
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
				const joiError = new Error(`Joi error: ${error}`);
				await this.createFallbackTask(joiError, true, "chatgpt")
			}

			// Log the value
			console.log("Validated Joi Object")
			console.log(value);

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
			const openai = new OpenAI({
				apiKey: this.openai.$auth.api_key,
			});

			// Check the number of tokens in the task
			const tokens = encode(rounds[roundNum]);
			if (tokens.length > maxTokens) {
				const error = new Error(`Task is too long. Max tokens: ${maxTokens}. Task tokens: ${tokens.length}`);
				await this.createFallbackTask(error, true, "chatgpt")
			}

			// Send the task prompt and system message to OpenAI
			try {
				return retry(
					async (bail, number) => {
						console.log(`Attempt number ${number} to send prompt to OpenAI.`);
						try {
							const response = await openai.chat.completions.create({
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
			} catch (err) {
				const error = new Error(`Error sending prompt to OpenAI: ${err}`);
				await this.createFallbackTask(error, true, "chatgpt")
			}
		},
		async calculateGPTCost(usage, model) {
			if (
				!usage ||
				typeof usage !== "object" ||
				!usage.prompt_tokens ||
				!usage.completion_tokens
			) {
				const error = new Error("Invalid usage object (thrown from calculateGPTCost).")
				await this.createFallbackTask(error, true, "chatgpt")
			}

			if (!model || typeof model !== "string") {
				const error = new Error("Invalid model string (thrown from calculateGPTCost).")
				await this.createFallbackTask(error, true, "chatgpt")
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
				const error = new Error("Non-supported model. (thrown from calculateGPTCost).")
				await this.createFallbackTask(error, true, "chatgpt")
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
					const error = new Error("Invalid JSON response from ChatGPT.")
					await this.createFallbackTask(error, true, "chatgpt")
				}
			}

			// Return the response array
			console.log("Response Array has a type of: " + typeof responseArray);
			console.log("Response Array:");
			console.log(responseArray);
			return responseArray;
		},
		async repairJSON(input) {
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
				const error = new Error("No JSON object or array found (in repairJSON).")
				await this.createFallbackTask(error, true, "chatgpt")
			}

			try {
				// Extract the JSON string from any non-JSON text sandwiching it, then run it through jsonrepair to fix any errors
				const JSONString = jsonrepair(
					input.substring(beginningIndex, endingIndex + 1)
				);

				// Return the repaired JSON string
				return JSONString;
			} catch (error) {
				const jsonRepairError = new Error(`JSON repair error: ${error}`)
				await this.createFallbackTask(jsonRepairError, true, "chatgpt")
			}
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
		async moderationCheck(message) {
			if (!message) {
				const error = new Error("Message cannot be empty or null.");
				await this.createFallbackTask(error, true, "chatgpt")
			}

			// Initialize the openai object
			const openai = new OpenAI({
				apiKey: this.openai.$auth.api_key,
			});

			try {
				return retry(
					async (bail, number) => {
						console.log(`Moderation attempt number: ${number}`);
						try {
							const response = await openai.moderations.create({
								input: message,
							});
	
							const flagged = response.data.results[0].flagged;
	
							if (flagged === undefined || flagged === null) {
								const error = new Error("Moderation check failed. Request to OpenAI's Moderation endpoint could not be completed.");
								await this.createFallbackTask(error, true, "chatgpt")
							}
	
							if (flagged === true) {
								const error = new Error("Detected inappropriate content in the prompt.");
								await this.createFallbackTask(error, true, "chatgpt")
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
			} catch (err) {
				const error = new Error(`Error sending moderation check to OpenAI: ${err}`);
				await this.createFallbackTask(error, true, "chatgpt")
			}
		},
		/* Start of Notion-specific methods */
		setPropChoices() {
			// Add user property and value choices to the config
			config.properties = {
				tasks_name: this.taskName,
				...(this.dueDate && { tasks_due_date: this.dueDate }),
				...(this.assignee && { tasks_assignee: this.assignee }),
				...(this.project && {
					tasks_project: config.notion_dbs.tasks.properties[this.project],
				}),
				...(this.source && { tasks_source: this.source }),
				...(this.source_value && { tasks_source_value: this.source_value }),
				...(this.status && {
					tasks_status: config.notion_dbs.tasks.properties[this.status],
				}),
				...(this.status_value && { tasks_status_value: this.status_value }),
				...(this.kanban_status && {
					tasks_kanban_status:
						config.notion_dbs.tasks.properties[this.kanban_status],
				}),
				...(this.kanban_status_value && {
					tasks_kanban_status_value: this.kanban_status_value,
				}),
				...(this.priority && {
					tasks_priority: config.notion_dbs.tasks.properties[this.priority],
				}),
				...(this.priority_value && {
					tasks_priority_value: this.priority_value,
				}),
				...(this.smart_list && {
					tasks_smart_list: config.notion_dbs.tasks.properties[this.smart_list],
				}),
				...(this.smart_list_value && {
					tasks_smart_list_value: this.smart_list_value,
				}),
				...(this.fuzzy_search_threshold && {
					tasks_fuzzy_search_threshold: this.fuzzy_search_threshold / 100,
				}),
			};

			// Construct an object to hold filter values
			if (
				this.database_filter_status_value ||
				this.database_filter_checkbox_value ||
				this.database_filter_date_value
			) {
				config.filters = {
					...(this.database_filter_status_value && {
						status: {
							property: this.database_filter_status,
							value: this.database_filter_status_value,
							type: config.notion_dbs.projects.properties[
								this.database_filter_status
							].type,
						},
					}),
					...(this.database_filter_checkbox_value !== undefined &&
						this.database_filter_checkbox_value !== null && {
							checkbox: {
								property: this.database_filter_checkbox,
								value: this.database_filter_checkbox_value,
							},
						}),
					...(this.database_filter_date_value && {
						date: {
							property: this.database_filter_date,
							value: this.database_filter_date_value,
						},
					}),
				};
			}
		},
		async getClosestNotionMatch(inputJSON, notion) {
			if (typeof inputJSON !== "object" || inputJSON === null) {
				const error = new Error("Invalid JSON input.")
				await this.createFallbackTask(error, true, "notion")
			}

			const taskArray = [];
			for (let task of inputJSON) {
				const taskDetails = {
					task: task.task_name,
					assignee: !task.assignee
						? "Not included."
						: await this.findNearestChoice(task.assignee, "assignee", notion),
					due: task.due_date || "Not included.",
					due_end: task.due_date_end || "Not included.",
					...(config.notion_dbs.projects.id && {
						project: !task.project
							? "Not included."
							: await this.findNearestChoice(task.project, "projects", notion),
					}),
					full_text: task.full_task_details || "Not included.",
				};

				for (let prop in taskDetails) {
					if (taskDetails[prop] === "Not included.") {
						delete taskDetails[prop];
					}
				}

				taskArray.push(taskDetails);
			}

			// Return the taskArray
			return taskArray;
		},
		async findNearestChoice(val, type, notion) {
			// Query Notion
			const rows = await this.queryNotion(type, notion);

			// Define the query type
			const queryType = type === "assignee" ? "user" : "db";

			// Flatten the rows array
			const flatRows = rows.flat();

			// Remove bot users
			const cleanedRows = [];
			for (let row of flatRows) {
				if (row.type === "person" || row.object === "page") {
					cleanedRows.push(row);
				}
			}

			// Create an new array, storing only Name and Notion Page ID of each object.
			const choiceArray = [];

			for (let result of cleanedRows) {
				try {
					const choiceName =
						queryType === "db"
							? result.properties.Name.title[0].plain_text
							: result.name;

					const choiceObj = {
						name: choiceName,
						id: result.id,
					};
					choiceArray.push(choiceObj);
				} catch (err) {
					const error = new Error(`Error creating item in choice array. This error occured when trying to find a match in Notion for ${val}.\n\nFull error details:\n\n${err}`);
					await this.createFallbackTask(error, false, "notion")
				}
			}

			// Find the closet option that matches the provided name
			const correctChoice = this.closestMatch(val, choiceArray);

			return correctChoice;
		},
		async queryNotion(type, notion) {
			// Pagination variables
			let hasMore = undefined;
			let token = undefined;

			// Set up our Bottleneck limiter
			const limiter = new Bottleneck({
				minTime: 333,
				maxConcurrent: 1,
			});

			// Handle 429 errors
			limiter.on("error", (error) => {
				const isRateLimitError = error.statusCode === 429;
				if (isRateLimitError) {
					console.log(
						`Job ${jobInfo.options.id} failed due to rate limit: ${error}`
					);
					const waitTime = error.headers["retry-after"]
						? parseInt(error.headers["retry-after"], 10)
						: 0.4;
					console.log(`Retrying after ${waitTime} seconds...`);
					return waitTime * 1000;
				}

				console.log(`Job ${jobInfo.options.id} failed: ${error}`);
				// Don't retry via limiter if it's not a 429
				return;
			});

			// Initial array for arrays of User or Project objects
			let rows = [];

			// Query the Notion API until hasMore == false. Add all results to the rows array
			while (hasMore == undefined || hasMore == true) {
				try {
					await retry(
						async (bail) => {
							let resp;
	
							let params = {
								page_size: 100,
								start_cursor: token,
							};
	
							try {
								if (type === "assignee") {
									resp = await limiter.schedule(() => notion.users.list(params));
									rows.push(resp.results);
								} else {
									params = {
										...params,
										database_id: config.notion_dbs[type].id,
										filter_properties: ["title"],
										...(config.filters &&
											Object.keys(config.filters).length >= 1 && {
												filter: this.getFilters(),
											}),
									};
									resp = await limiter.schedule(() =>
										notion.databases.query(params)
									);
									rows.push(resp.results);
								}
	
								hasMore = resp.has_more;
								if (resp.next_cursor) {
									token = resp.next_cursor;
								}
							} catch (error) {
								if (400 <= error.status && error.status <= 409) {
									// Don't retry for errors 400-409
									bail(error);
									return;
								}
	
								if (
									error.status === 500 ||
									error.status === 503 ||
									error.status === 504
								) {
									// Retry on 500, 503, and 504
									throw error;
								}
	
								// Don't retry for other errors
								bail(error);
							}
						},
						{
							retries: 2,
							onRetry: (error, attempt) => {
								console.log(`Attempt ${attempt} failed. Retrying...`);
							},
						}
					);
				} catch (err) {
					const error = new Error(`Error querying Notion to fetch ${type}. Creating fallback task.\n\nFull error details:\n\n${err}`);
					await this.createFallbackTask(error)
				}
			}

			return rows;
		},
		closestMatch(val, arr, keys) {
			// Set the Fuse options
			const options = {
				keys: keys || ["name"],
				includeScore: true,
				threshold: this.tasks_fuzzy_search_threshold
					? this.tasks_fuzzy_search_threshold
					: 0.4,
			};

			// Create a new Fuse object
			const fuse = new Fuse(arr, options);

			// Search for the closest match
			const result = fuse.search(val);

			if (result.length === 0) {
				return "Not included.";
			} else {
				return result[0].item;
			}
		},
		getFilters() {
			const filter = {
				and: [], // Array of filter objects
			};

			// Add a checkbox filter if the user selected one
			if (
				config.filters.checkbox.value !== undefined &&
				config.filters.checkbox.value !== null
			) {
				filter.and.push({
					property: config.filters.checkbox.property,
					checkbox: {
						equals: config.filters.checkbox.value,
					},
				});
			}

			// Add a recency filter if the user selected one
			if (config.filters.date.value) {
				// Construct the date object
				const originalDate = new Date(config.original_body.date);
				const adjustedDate = new Date(
					originalDate.getTime() -
						config.filters.date.value * 24 * 60 * 60 * 1000
				);
				adjustedDate.setHours(0, 0, 0, 0);
				const adjustedDateISOString = adjustedDate.toISOString();

				// Determine the type of the date property
				const datePropertyType =
					config.notion_dbs.projects.properties[config.filters.date.property]
						.type;

				if (datePropertyType === "date") {
					filter.and.push({
						property: config.filters.date.property,
						date: {
							on_or_after: adjustedDateISOString,
						},
					});
				} else if (
					datePropertyType === "created_time" ||
					datePropertyType === "last_edited_time"
				) {
					filter.and.push({
						timestamp: datePropertyType,
						[datePropertyType]: {
							on_or_after: adjustedDate,
						},
					});
				}
			}

			// Add a select/status filter if the user selected one
			if (config.filters.status.value) {
				// Determine the type of the select/status property
				const statusPropertyType =
					config.notion_dbs.projects.properties[config.filters.status.property]
						.type;

				// Create an array for the status/select values, formatted correctly for Notion filters
				const statusValues = [];
				config.filters.status.value.forEach((value) => {
					statusValues.push({
						property: config.filters.status.property,
						[statusPropertyType]: {
							equals: value,
						},
					});
				});

				filter.and.push({
					or: statusValues,
				});
			}

			return filter;
		},
		formatChatResponse(resultsArray, cost, source) {
			return resultsArray.map((result) =>
				this.creatNotionObject(result, cost, source)
			);
		},
		creatNotionObject(result, cost, source = "Pipedream") {
			const costString = `$${cost.toFixed(4)}`;

			if (this.remove_midnight === true && result.due) {
				const pattern = /T00:00:00(\.\d+)?[+-]\d{2}:\d{2}$/;
				if (pattern.test(result.due)) {
					console.log('Midnight time part removed from result.due');
					result.due = result.due.replace(pattern, '');
				}
			}

			if (this.remove_midnight === true && result.due_end) {
				const pattern = /T00:00:00(\.\d+)?[+-]\d{2}:\d{2}$/;
  				if (pattern.test(result.due_end)) {
					console.log('Midnight time part removed from result.due_end');
					result.due_end = result.due_end.replace(pattern, '');
				}
			}


			return {
				parent: {
					database_id: config.notion_dbs.tasks.id,
				},
				properties: {
					[config.properties.tasks_name]: {
						title: [
							{
								text: {
									content: result.task,
								},
							},
						],
					},
					...(config.properties.tasks_source_value && {
						[config.properties.tasks_source]: {
							select: {
								name: config.properties.tasks_source_value,
							},
						},
					}),
					...(config.properties.tasks_status_value && {
						[config.properties.tasks_status.name]: {
							status: {
								name: config.properties.tasks_status_value,
							},
						},
					}),
					...(config.properties.tasks_kanban_status_value && {
						// Check for value instead?
						[config.properties.tasks_kanban_status.name]: {
							[config.properties.tasks_kanban_status.type]: {
								// Can be Status or State
								name: config.properties.tasks_kanban_status_value,
							},
						},
					}),
					...(config.properties.tasks_priority_value && {
						[config.properties.tasks_priority.name]: {
							[config.properties.tasks_priority.type]: {
								// Can be Status or State
								name: config.properties.tasks_priority_value,
							},
						},
					}),
					...(config.properties.tasks_smart_list_value && {
						[config.properties.tasks_smart_list.name]: {
							[config.properties.tasks_smart_list.type]: {
								// Can be Status or State
								name: config.properties.tasks_smart_list_value,
							},
						},
					}),
					...(result.assignee && {
						[config.properties.tasks_assignee]: {
							people: [
								{
									id: result.assignee.id,
								},
							],
						},
					}),
					...(result.due && {
						[config.properties.tasks_due_date]: {
							date: {
								start: result.due,
								...(result.due_end && {
									end: result.due_end,
								}),
							},
						},
					}),
					...(result.project && {
						[config.properties.tasks_project.name]: {
							relation: [
								{
									id: result.project.id,
								},
							],
						},
					}),
				},
				children: [
					{
						object: "block",
						type: "callout",
						callout: {
							icon: {
								emoji: "🤖",
							},
							color: "blue_background",
							rich_text: [
								{
									text: {
										content: `This task was created via the following source: ${source}. The cost of this request was ${costString}.`,
									},
								},
							],
						},
					},
					{
						object: "block",
						type: "paragraph",
						paragraph: {
							rich_text: [
								{
									type: "text",
									text: {
										content: "Full text of task:",
									},
									annotations: {
										bold: true,
									},
								},
							],
						},
					},
					{
						object: "block",
						type: "paragraph",
						paragraph: {
							rich_text: [
								{
									type: "text",
									text: {
										content: result.full_text,
									},
								},
							],
						},
					},
					{
						object: "block",
						type: "paragraph",
						paragraph: {
							rich_text: [
								{
									type: "text",
									text: {
										content: "Entire request sent to ChatGPT:",
									},
									annotations: {
										bold: true,
									},
								},
							],
						},
					},
					{
						object: "block",
						type: "paragraph",
						paragraph: {
							rich_text: [
								{
									type: "text",
									text: {
										content: config.original_body.task,
									},
								},
							],
						},
					},
				],
			};
		},
		async createTasks(formattedArray, notion) {
			try {
				// Create a new Bottleneck limiter
				const limiter = new Bottleneck({
					maxConcurrent: 1,
					minTime: 333,
				});

				// Handle 429 errors
				limiter.on("error", (error) => {
					const isRateLimitError = error.statusCode === 429;
					if (isRateLimitError) {
						console.log(`Job ${error.id} failed due to rate limit: ${error}`);
						const waitTime = error.headers["retry-after"]
							? parseInt(error.headers["retry-after"], 10)
							: 0.4;
						console.log(`Retrying after ${waitTime} seconds...`);
						return waitTime * 1000;
					}

					console.log(`Job ${error.id} failed: ${error}`);
					// Don't retry via limiter if it's not a 429
					return;
				});

				// Create a new task for each item in the array
				const results = await Promise.all(
					formattedArray.map((task) => {
						return retry(
							async (bail) => {
								try {
									const response = await limiter.schedule(() =>
										notion.pages.create(task)
									);
									return response;
								} catch (error) {
									if (400 <= error.status && error.status <= 409) {
										// Don't retry for errors 400-409
										console.log("Error creating Notion task:", error);
										bail(error);
									} else {
										console.log("Error creating Notion task:", error);
										throw error;
									}
								}
							},
							{
								retries: 3,
								onRetry: (error) =>
									console.log("Retrying Notion task creation:", error),
							}
						);
					})
				);

				return results;
			} catch (err) {
				const error = new Error(`Error creating task in Notion: ${err}`);
				await this.createFallbackTask(error, true, "notion")
			}
		},
		async sendResponse($, taskNum, startTime, cost) {
			if (this.sendResponse === true) {
				// Set the plurality of task(s)
				const taskPlurality = taskNum === 1 ? "task" : "tasks";

				// Get the duration of the run
				const endTime = Date.now();
				const duration = (endTime - startTime) / 1000;

				// Get the cost
				const costString = cost.toFixed(4);

				await $.respond({
					status: 200,
					headers: {},
					body: `Success! Created ${taskNum} ${taskPlurality} in Notion.
					Operation took ${duration} seconds and cost $${costString} to complete.`,
				});
			} else {
				await $.respond({
					status: 200,
					headers: {},
					body: `Task(s) has been sent to ChatGPT for processing.`,
				});
			}
		},
		/* Fallback and Error-Handling Methods */
		async checkBody() {
			const requiredProps = ["task", "name", "date", "secret"];

			for (let prop of requiredProps) {
				if (!config.original_body[prop]) {
					const error = new Error(
						`Missing property "${prop}" in request body.`
					);
					await this.createFallbackTask(error, true, "config")
				}
			}

			if (config.original_body.secret !== this.secret) {
				const error = new Error("Secret key in the request does not match the key configured in the workflow settings. The secret key used in this request was: " + config.original_body.secret);
				await this.createFallbackTask(error, true, "config")
			}

			// Send the user a warning email if the task text was over 750 chars
			if (config.original_body.task.length > 750) {
				const $ = config.pipedream;
				$.send.email({
					subject: `[Notion Voice Tasks] – Warning: Abnormally long task text`,
					text: `A request was sent to your Notion Voice Tasks workflow in Pipedream with task text over 750 characters.\n\nIf you or one or your authorized users sent this request, you can safely disregard this email.\n\nOtherwise, please check your workflow history to check if an unauthorized party is sending requests to your workflow.\n\nThe full text of your request is:\n\n${config.original_body.task}`,
				});
			}
		},
		async createFallbackTask(error, terminate = true, source = "notion") {
			const $ = config.pipedream
			
			if (source === "chatgpt") {
				console.log("ChatGPT failed to parse the user's request. Creating a fallback task in Notion and emailing the user...");
			} else if (source === "notion") {
				console.log("Failed to create the task(s) in Notion. Sending error email to user...");
			} else if (source === "config") {
				console.log("A configuration error occured. Sending error email to user...")
			} else {
				console.log("An error occurred. Sending error email to user...");
			}

			const task = {
				task: `[CHATGPT FAILED TO PARSE]: ${config.original_body.task}`,
				full_text: `${config.original_body.task} – (Task created by ${config.original_body.name} on ${config.original_body.date}.)`,
			}

			const error_details = {
				chatgpt: {
					subject: `[Notion Voice Tasks] – ChatGPT Error`,
					body() {
						return `ChatGPT failed to process a request made via your Notion Voice Tasks workflow, sent by ${config.original_body.name} at ${config.original_body.date}.\n\nThe full text of your request is:\n\n${config.original_body.task}\n\nYou can access the task that was created in Notion at ${this.task_url}.\n\nThe full error message is:\n\n${error}`
					},
					http_response: `Partial failure. ChatGPT encountered an error, so one task was created in Notion containing all the details of your request as a fallback, and an email with more detials was sent to your Pipedream account's email address. The full task text is: ${config.original_body.task}`
				},
				notion: {
					subject: `[Notion Voice Tasks] – Notion Error`,
					body() {
						return `Failed to create task(s) in Notion from a request via your Notion Voice Tasks workflow, sent by ${config.original_body.name} at ${config.original_body.date}.\n\nThe full text of your request is:\n\n${config.original_body.task}\n\nThe full error message is:\n\n${error}`
					},
					http_response: `Failed to create task(s) in Notion due to an error. An email with details of the error has been sent to your Pipedream account's email address. The full text of your task request is: ${config.original_body.task}`
				},
				config: {
					subject: `[Notion Voice Tasks] – Configuration Error`,
					body() {
						return `A configuration error occured in your Notion Voice Tasks workflow. The error message is:\n\n${error}`
					},
					http_response: `Failed to create task(s) in Notion due to a configuration error. An email with details of the error has been sent to your Pipedream account's email address. The full text of your task request is: ${config.original_body.task}`
				}
			}

			if (source === "Notion") {
				const notion = new Client({ auth: this.notion.$auth.oauth_access_token });

				console.log("Creating a Notion-compliant task object...")
				const notionObject = this.creatNotionObject(task, 0, "Error Fallback Routine");

				const taskArray = [notionObject];

				console.log("Sending the task to Notion...");
				const response = await this.createTasks(taskArray, notion);

				const taskID = response[0].id;
				error_details.chatgpt.task_url = `https://notion.so/${taskID.replace(/-/g, "")}`;
			}

			console.log("Sending an email to the user with error details...");
			$.send.email({
				subject: error_details[source].subject,
				text: error_details[source].body(),
			})

			console.log("Sending an HTTP response to the user...");
			await $.respond({
				status: 200,
				headers: {},
				body: error_details[source].http_response,
			});

			if (terminate === true) {
				console.log("Ending the workflow and throwing an error...");
				throw new Error(error)
			} else {
				console.error("Non-workflow-ending error:", error)
			}

		},
	},
	async run({ steps, $ }) {
		if (!this.send_response || this.send_response === false) {
			await this.sendResponse($);
		}
		
		// Add the original body to the config (used as a fallback if ChatGPT fails)
		config.original_body = steps.trigger.event.body;
		
		// Add the pipedream object to the config
		config.pipedream = $;
		
		// Check the request body for all required properties
		await this.checkBody();

		// Initialize the Notion SDK
		const notion = new Client({ auth: this.notion.$auth.oauth_access_token });

		// Fetch the Tasks database
		let database
		try {
			database = await retry((bail) => {
				try {
					const response = notion.databases.retrieve({
						database_id: this.databaseID,
					});

					return response;
				} catch (error) {
					if (400 <= error.status && error.status <= 409) {
						// Don't retry for errors 400-409
						bail(error);
					} else {
						throw error;
					}
				}
			},
			{
				retries: 2,
			})
		} catch (err) {
			const error = new Error(`Error retrieving Notion Tasks database: ${err}`);
			await this.sendErrorMessages(error)
		}

		// Get the Tasks database properties
		let properties
		try {
			if (database.hasOwnProperty("properties")) {
				properties = database.properties;
			} else {
				throw new Error("Database properties not found.")
			}
		} catch (err) {
			const error = new Error(`Error retrieving Notion Tasks database properties: ${err}`);
			await this.sendErrorMessages(error)
		}

		// Update the config with the Tasks database ID and properties
		config.notion_dbs.tasks.id = this.databaseID;
		config.notion_dbs.tasks.properties = properties;

		// Update the config with Project database properties if the project database is set
		if (this.project) {
			let projectsDatabase
			try {
				projectsDatabase = await retry((bail) => {
					try {
						const response = notion.databases.retrieve({
							database_id: properties[this.project].relation.database_id,
						});

						return response;
					} catch (error) {
						if (400 <= error.status && error.status <= 409) {
							// Don't retry for errors 400-409
							bail(error);
						} else {
							throw error;
						}
					}
				},
				{
					retries: 2,
				})
			} catch (err) {
				const error = new Error(`Error retrieving Notion Projects database. Attempting to create tasks without Project assignments. Error details: ${err}`);
				await this.sendErrorMessages(error, false)
			}

			// Add the Project DB's ID and properties to the config object
			try {
				config.notion_dbs.projects.id = properties[this.project].relation.database_id;
				if (projectsDatabase.hasOwnProperty("properties")) {
					config.notion_dbs.projects.properties = projectsDatabase.properties;
				} else {
					throw new Error("Project database properties not found.")
				}
			} catch (err) {
				const error = new Error(`Error retrieving Notion Projects database properties. Attempting to create tasks without Project assignments. Error details: ${err}`);
				await this.sendErrorMessages(error, false)
			}
		}

		// Set all the user's prop choices in the config
		this.setPropChoices();
		console.log("Config settings:");
		console.log(JSON.stringify(config, null, 2));

		// Bring in the return value from the ChatGPT step
		const chatGPT_results = await this.chatGTPHandler(steps)

		// Query Notion for Assignees and Projects
		const matchedResponse = await this.getClosestNotionMatch(
			chatGPT_results.final_response,
			notion
		);

		// Remove assignee and/or due date if user didn't set these properties
		for (let item of matchedResponse) {
			if (!config.properties.hasOwnProperty("tasks_due_date")) {
				delete item.due;
			}

			if (!config.properties.hasOwnProperty("tasks_assignee")) {
				delete item.assignee;
			}
		}

		// Build a Notion API compliant tasks array
		const formattedResponse = this.formatChatResponse(
			matchedResponse,
			chatGPT_results.cost,
			config.properties.tasks_source_value ?? undefined
		);

		console.log("Formatted Response:");
		console.log(formattedResponse);

		console.log("Sending tasks to Notion...")

		// Create the tasks in Notion
		const notionResponse = await this.createTasks(formattedResponse, notion);

		// Log the response
		console.log("Notion response:");
		console.log(notionResponse);

		// Send the response to the user
		if (this.send_response === true) {
			await this.sendResponse(
				$,
				notionResponse.length,
				chatGPT_results.start_timestamp,
				chatGPT_results.cost
			);
		}

		return notionResponse;
	},
});