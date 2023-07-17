// Import dependencies
import { Client } from "@notionhq/client";
import Bottleneck from "bottleneck";
import Fuse from "fuse.js";
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
};

export default defineComponent({
	props: {
		notion: {
			type: "app",
			app: "notion",
		},
		databaseID: {
			type: "string",
			label: "Tasks Database",
			description: "Select your tasks database.",
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
			reloadProps: true,
		},
	},
	async additionalProps() {
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
				}`,
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
				}`,
				options: selectProps
					.concat(statusProps)
					.map((prop) => ({ label: prop, value: prop })),
				optional: kanbanFlag ? false : true,
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
						"Type or select a value for your chosen Source property. If you don't choose a Source property, this value will be ignored. If you type in one that doesn't exist, it will be created as an option in your chosen property.",
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
			...(this.project && {
				fuzzy_search_threshold: {
					type: "integer",
					label: "Project-matching Search Score Threshold",
					description: `The projects named in your input are matched against project pages in the Projects database connected to your ${this.project} Relation property. Fuzzy search is used to match the right project, even if you didn't say the name exactly right. You can adjust this value to make the matching more or less strict. A score of 0 will require an exact match; a score of 100 will match the nearest Project, no matter how different it is. The default is 40, which is generally effective. I typically don't recommend setting the score higher, but you can set it lower if you find that your tasks are getting matched to the wrong projects. It's much better for a task to get NO matched Project (and therefore ideally be sent to your Inbox) than for it to be matched with the wrong project.`,
					default: 40,
					optional: true
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
					label: `Kanban Status Value${kanbanFlag ? requiredString : ""} – (for chosen property: ${this.kanban_status})`,
					description: `Choose a value for your Kanban Status property${
						kanbanFlag ? requiredString + "." : "."
					} If you don't choose one, Kanban Status will be ignored.`,
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
					label: `Priority Value${priorityFlag ? requiredString : ""} – (for chosen property: ${this.priority})`,
					description: `Choose a value for your Priority property${
						priorityFlag ? requiredString + "." : "."
					} If you don't choose one, Priority will be ignored.`,
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
		};

		return props;
	},
	methods: {
		setPropChoices(date) {
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
					tasks_fuzzy_search_threshold: this.fuzzy_search_threshold / 100
				})
			};

			// Pass the current date with timezone (from the user's device) to the configs
			config.current_date = date;

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
									database_id: config.notion_dbs[type].id,
									filter_properties: ["title"],
									...(config.filters && Object.keys(config.filters).length >= 1 && {
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
				threshold: this.tasks_fuzzy_search_threshold ? this.tasks_fuzzy_search_threshold : 0.4,
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
				const originalDate = new Date(config.current_date);
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
			// To do: Make sure this works, call it from run()
			return resultsArray.map((result) =>
				this.creatNotionObject(result, cost, source)
			);
		},
		creatNotionObject(result, cost, source = "Pipedream") { // To do: Adjust all the config.props references to make more sense
			// Format the cost
			const costString = `$${cost.toFixed(4)}`;

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
										content: `This task was created via the ${source}. The cost of this request was ${costString}.`,
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
									}
								}
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
										content: result.full_text
									}
								}
							],
						},
					}
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
									} else if (
										error.status === 500 ||
										error.status === 503 ||
										error.status === 504
									) {
										// Retry for 500, 503, and 504 errors
										console.log("Error creating Notion task:", error);
										throw error;
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
			} catch (error) {
				console.log("Error creating task in Notion: ", error);
			}
		},
		async sendResponse($, taskNum, startTime, cost) {
			// Set the plurality of task(s)
			const taskPlurality = taskNum === 1 ? "task" : "tasks";

			// Get the duration of the run
			const endTime = Date.now();
			const duration = (endTime - startTime) / 1000;

			// Get the cost
			const costString = cost.toFixed(4)

			await $.respond({
				status: 200,
				headers: {},
				body: `Success! Created ${taskNum} ${taskPlurality} in Notion.
				Operation took ${duration} seconds and cost $${costString} to complete.`,
			})
		}
	},
	async run({ steps, $ }) {
		// Grab the current datetime string from the trigger
		const current_date = steps.trigger.event.body.date;

		// Initialize the Notion SDK
		const notion = new Client({ auth: this.notion.$auth.oauth_access_token });

		// Fetch the Tasks database properties
		const database = await notion.databases.retrieve({
			database_id: this.databaseID,
		});

		const properties = database.properties;

		// Update the config with the Tasks database ID and properties
		config.notion_dbs.tasks.id = this.databaseID;
		config.notion_dbs.tasks.properties = properties;

		// Update the config with Project database properties if the project database is set
		if (this.project) {
			const projectsDatabase = await notion.databases.retrieve({
				database_id: properties[this.project].relation.database_id,
			});

			// Add the Project DB's ID and properties to the config object
			config.notion_dbs.projects.id =
				properties[this.project].relation.database_id;
			config.notion_dbs.projects.properties = projectsDatabase.properties;
		}

		// Set all the user's prop choices in the config
		this.setPropChoices(current_date);
		console.log("Config settings:");
		console.log(JSON.stringify(config, null, 2));

		// Bring in the return value from the ChatGPT step
		const chatGPT_results = steps.Parse_task_with_ChatGPT.$return_value;

		// Query Notion for Assignees and Projects
		const matchedResponse = await this.getClosestNotionMatch(
			chatGPT_results.final_response,
			notion
		);

		// Remove assignee and/or due date if user didn't set these properties
		for (let item of matchedResponse) {
			if (!config.properties.hasOwnProperty('tasks_due_date')) {
				delete item.due
			}

			if(!config.properties.hasOwnProperty('tasks_assignee')) {
				delete item.assignee
			}
		}

		// Build a Notion API compliant tasks array
		const formattedResponse = this.formatChatResponse(
			matchedResponse,
			chatGPT_results.cost,
			config.properties.tasks_source_value ?? undefined
		)

		console.log(JSON.stringify(formattedResponse))
		console.log(formattedResponse)

		// Create the tasks in Notion
		const notionResponse = await this.createTasks(formattedResponse, notion);
		
		// Sent the response to the user
		await this.sendResponse(
			$,
			notionResponse.length,
			chatGPT_results.start_timestamp,
			chatGPT_results.cost,
		)

		return notionResponse
	},
});
