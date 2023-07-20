// Import dependencies
import { Client } from "@notionhq/client";
import Bottleneck from "bottleneck";
import Fuse from "fuse.js";
import retry from "async-retry";

const config = {
	notion_dbs: {
		tasks: "",
		projects: "",
	},
};

export default defineComponent({
	props: {
		notion: {
			type: "app",
			app: "notion",
		},
		project_db_id: {
			type: "string",
			label: "Projects Database",
			description:
				"Your Projects database. Set a value here if you need to add filtering options (typically only needed if your Projects database has hundreds of pages). Otherwise, simply leave this blank. 99% of users will not need to set a value here. If you do, the selected database MUST match the Project Relation you set in the previous step. Adding multiple filters will create an AND query; it is not possible to create an OR query.",
			async options({ query, prevContext }) {
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

				const options = response.results.map((db) => ({
					label: db.title?.[0]?.plain_text,
					value: db.id,
				}));

				return {
					context: {
						cursor: response.next_cursor,
					},
					options,
				};
			},
			optional: true,
			reloadProps: true,
		},
		threshold: {
			type: "integer",
			label: "Search Threshold",
			description:
				"The threshold for the search algorithm. Defaults to 40. The lower the threshold, the stricter the search. 0 would require an exact match (for both user and project). 100 will return the first result, regardless of how close it is to the user input. It is not recommended to change this value unless you're not getting the results you expect.",
			default: 40,
			optional: true,
		},
	},
	async additionalProps() {
		const filterProps = {};

		let properties;

		if (this.project_db_id) {
			const notion = new Client({
				auth: this.notion.$auth.oauth_access_token,
			});

			const database = await notion.databases.retrieve({
				database_id: this.project_db_id,
			});

			properties = database.properties;

			const supportedFilterProperties = {
				status: ["status", "select"],
				date: ["date", "last_edited_time", "created_time"],
				checkbox: ["checkbox"],
			};

			filterProps.status = Object.keys(properties).filter((k) =>
				supportedFilterProperties.status.includes(properties[k].type)
			);
			filterProps.date = Object.keys(properties).filter((k) =>
				supportedFilterProperties.date.includes(properties[k].type)
			);
			filterProps.checkbox = Object.keys(properties).filter((k) =>
				supportedFilterProperties.checkbox.includes(properties[k].type)
			);
		}

		const props = {
			database_filter_status: {
				type: "string",
				label: "Project Status Filter",
				description:
					'Status or Select property to use as a filter for the Projects database. Once you select a property here, you\'ll get a new field to select the value you want to filter by. For example, you could select a Status-type property here, then select "In Progress" as the value to filter by.',
				options: filterProps?.status?.map((prop) => ({
					label: prop,
					value: prop,
				})),
				optional: true,
				reloadProps: true,
			},
			database_filter_checkbox: {
				type: "string",
				label: "Project Checkbox Filter",
				description:
					"Checkbox property to use as a filter for the Projects database. Once you select a property here, you'll get a new field to select the value you want to filter by. For example, you could select a Checkbox-type property here, then select true as the value to filter by.",
				options: filterProps?.checkbox?.map((prop) => ({
					label: prop,
					value: prop,
				})),
				optional: true,
				reloadProps: true,
			},
			database_filter_date: {
				type: "string",
				label: "Project Date Filter",
				description:
					"Date, Created Time, or Last Edited Time property to use as a recency filter for the Projects database. Once you select a property here, you'll get a new field to select a number of days you want to filter by. For example, you could select a Last Edited Time-type property here, then select 7 days as the value to filter by. This would return projects that were last edited within the last 7 days.",
				options: filterProps?.date?.map((prop) => ({
					label: prop,
					value: prop,
				})),
				optional: true,
				reloadProps: true,
			},
			...(this.database_filter_status && {
				database_filter_status_value: {
					type: "string[]",
					label: "Status/Select Filter Value",
					description:
						'The value(s) to filter by for the Status/Select property. You can select multiple values here (e.g. "In Progress" and "Not Started").',
					options: this.database_filter_status
						? properties[this.database_filter_status][
								properties[this.database_filter_status].type
						  ].options.map((option) => ({
								label: option.name,
								value: option.name,
						  }))
						: [],
				},
			}),
			...(this.database_filter_checkbox && {
				database_filter_checkbox_value: {
					type: "boolean",
					label: "Checkbox Filter Value",
					description: "The value to filter by for the Checkbox property.",
				},
			}),
			...(this.database_filter_date && {
				database_filter_date_value: {
					type: "integer",
					label: "Date Filter Value",
					description:
						"The number of days since today to filter by for the Date, Created Time, or Last Edited Time property. For example, if you select 7 here, the filter will return projects where your selected Date, Created Time, or Last Edited Time property's value is within the last 7 days.",
				},
			}),
		};

		return props;
	},
	methods: {
		async getClosestNotionMatch(inputJSON, notion) {
			if (typeof inputJSON !== "object" || inputJSON === null) {
				throw new Error("Invalid JSON input.");
			}

			const taskArray = [];
			for (let task of inputJSON) {
				const taskDetails = {
					task: task.task_name,
					assignee: !task.assignee
						? "Not included."
						: await this.findNearestChoice(task.assignee, "assignee", notion),
					due: task.due_date || "Not included.",
					...(config.notion_dbs.projects && {
						project: !task.project
							? "Not included."
							: await this.findNearestChoice(task.project, "projects", notion),
					}),
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
				} catch (e) {
					console.log(e instanceof TypeError); // true
					console.log(e.message); // "null has no properties"
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
									database_id: config.notion_dbs[type],
									filter_properties: ["title"],
									...(Object.keys(config.filters).length >= 1 && {
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
			}

			return rows;
		},
		closestMatch(val, arr, keys) {
			// Set the Fuse options
			const options = {
				keys: keys || ["name"],
				includeScore: true,
				threshold: this.threshold ? this.threshold / 100 : 0.4,
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
				this.database_filter_checkbox_value !== undefined &&
				this.database_filter_checkbox_value !== null
			) {
				filter.and.push({
					property: this.database_filter_checkbox,
					checkbox: {
						equals: this.database_filter_checkbox_value,
					},
				});
			}

			// Add a recency filter if the user selected one
			if (this.database_filter_date_value) {
				// Construct the date object
				const originalDate = new Date(config.current_date);
				const adjustedDate = new Date(
					originalDate.getTime() -
						this.database_filter_date_value * 24 * 60 * 60 * 1000
				);
				adjustedDate.setHours(0, 0, 0, 0);
				const adjustedDateISOString = adjustedDate.toISOString();

				// Determine the type of the date property
				const datePropertyType =
					config.properties[this.database_filter_date].type;

				if (datePropertyType === "date") {
					filter.and.push({
						property: this.database_filter_date,
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
			if (this.database_filter_status_value) {
				// Determine the type of the select/status property
				const statusPropertyType =
					config.properties[this.database_filter_status].type;

				// Create an array for the status/select values, formatted correctly for Notion filters
				const statusValues = [];
				this.database_filter_status_value.forEach((value) => {
					statusValues.push({
						property: this.database_filter_status,
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
	},
	async run({ steps, $ }) {
		// Check that the user configured the minimum settings from the previous step
		if (!steps.notion_tasks_settings.$return_value.tasks_db_id) {
			throw new Error(
				"Tasks database is required to be set. Please choose a tasks database in the previous step."
			);
		}

		if (!steps.notion_tasks_settings.$return_value.tasks_name) {
			throw new Error(
				"Task Name property is required to be set. Please set a Task Name property in the previous step."
			);
		}

		// If the user set a Project Relation in the previous step AND chose a Projects database in this step, we have to check that they match.
		if (
			this.project_db_id &&
			steps.notion_tasks_settings.$return_value.tasks_project.relation
				.database_id
		) {
			if (
				steps.notion_tasks_settings.$return_value.tasks_project.relation
					.database_id !== this.project_db_id
			) {
				throw new Error(
					"Project database must match the project database selected in the previous step."
				);
			}
		}

		// Pass the current date with timezone (from the user's device) to the configs
		config.current_date = steps.trigger.event.body.date;

		// Construct an object to hold filter values
		config.filters = {
			...(this.database_filter_status_value && {
				status: this.database_filter_status_value,
				type: config.properties,
			}),
			...(this.database_filter_checkbox_value !== undefined &&
				this.database_filter_checkbox_value !== null && {
					checkbox: this.database_filter_checkbox_value,
				}),
			...(this.database_filter_date_value && {
				date: this.database_filter_date_value,
			}),
		};

		// Update the config with step information
		config.notion_dbs.tasks =
			steps.notion_tasks_settings.$return_value.tasks_db_id;

		if (this.project_db_id) {
			config.notion_dbs.projects = this.project_db_id;
		} else if (steps.notion_tasks_settings.$return_value.tasks_project) {
			config.notion_dbs.projects =
				steps.notion_tasks_settings.$return_value.tasks_project.relation.database_id;
		} else {
			config.notion_dbs.projects = "";
		}

		// Initialize the Notion SDK
		const notion = new Client({ auth: this.notion.$auth.oauth_access_token });

		// If the Projects db is set, get the properties again
		if (config.notion_dbs.projects) {
			const projectProperties = await notion.databases.retrieve({
				database_id: config.notion_dbs.projects,
			});
			config.properties = projectProperties.properties;
		}

		const matchedResponse = await this.getClosestNotionMatch(
			steps.Validate_ChatGPT_response.$return_value,
			notion
		);
		return matchedResponse;
	},
});
