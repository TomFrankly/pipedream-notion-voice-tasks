/** 
 * This is the PREVIOUS Query-Notion step, before I added any user fields.
 */

// Import dependencies
import { Client } from "@notionhq/client"
import Bottleneck from "bottleneck"
import Fuse from "fuse.js"
import retry from "async-retry"

const config = {
  search_threshold: 0.4,
  notion_dbs: {
    tasks: "",
    projects: ""
  }
}

/** Create a new taskDetails array. Task name and due are transferred over from
 *  the original object without any changes. Assignee and Project are set
 *  using the findNearestOption() function, which queries the Notion API and finds
 *  the closest option to the one provided using Fuse search.
 * */
async function getClosestNotionMatch(inputJSON, notion) {
	if (typeof inputJSON !== "object" || inputJSON === null) {
		throw new Error("Invalid JSON input.")
	}

	const taskArray = []
	for (let task of inputJSON) {
		const taskDetails = {
			task: task.task_name,
			assignee: !task.assignee
				? "Not included."
				: await findNearestChoice(task.assignee, "assignee", notion),
			due: task.due_date || "Not included.",
			...(config.notion_dbs.projects && {
				project: !task.project
					? "Not included."
					: await findNearestChoice(task.project, "projects", notion)
			}),
		}

		for (let prop in taskDetails) {
			if (taskDetails[prop] === "Not included.") {
				delete taskDetails[prop]
			}
		}

		taskArray.push(taskDetails)
	}

	// Return the taskArray
	return taskArray
}

/**  Query Notion (users or dbs) using the provided value (e.g. Project)
 *  Get a response from Notion, then send all rows to the closestMatch() function
 *  to find the closest match to the provided value.
 * */
async function findNearestChoice(val, type, notion) {
	console.log("Type: " + type)
  
  // Query Notion
	const rows = await queryNotion(type, notion)

	// Define the query type
	const queryType = type === "assignee" ? "user" : "db"

	// Flatten the rows array
	const flatRows = rows.flat()

	// Remove bot users
	const cleanedRows = []
	for (let row of flatRows) {
		if (row.type === "person" || row.object === "page") {
			cleanedRows.push(row)
		}
	}

	// Create an new array, storing only Name and Notion Page ID of each object.
	const choiceArray = []

	for (let result of cleanedRows) {
		try {
			const choiceName =
				queryType === "db"
					? result.properties.Name.title[0].plain_text
					: result.name

			const choiceObj = {
				name: choiceName,
				id: result.id,
			}
			choiceArray.push(choiceObj)
		} catch (e) {
			console.log(e instanceof TypeError) // true
			console.log(e.message) // "null has no properties"
		}
	}

	// Find the closet option that matches the provided name
	const correctChoice = closestMatch(val, choiceArray)

	return correctChoice
}

// Query the Notion API to get a list of either all projects in the Projects db, or all users.
async function queryNotion(type, notion) {
  
  // Pagination variables
	let hasMore = undefined
	let token = undefined

	// Set up our Bottleneck limiter
	const limiter = new Bottleneck({
		minTime: 333,
		maxConcurrent: 1,
	})

	// Handle 429 errors
	limiter.on("error", (error) => {
		const isRateLimitError = error.statusCode === 429
		if (isRateLimitError) {
			console.log(
				`Job ${jobInfo.options.id} failed due to rate limit: ${error}`
			)
			const waitTime = error.headers["retry-after"]
				? parseInt(error.headers["retry-after"], 10)
				: 0.4
			console.log(`Retrying after ${waitTime} seconds...`)
			return waitTime * 1000
		}

		console.log(`Job ${jobInfo.options.id} failed: ${error}`)
		// Don't retry via limiter if it's not a 429
		return
	})

	// Initial array for arrays of User or Project objects
	let rows = []

	// Query the Notion API until hasMore == false. Add all results to the rows array
	while (hasMore == undefined || hasMore == true) {
		await retry(
			async (bail) => {
				let resp

				let params = {
					page_size: 100,
					start_cursor: token,
				}

				try {
					if (type === "assignee") {
						resp = await limiter.schedule(() => notion.users.list(params))
						rows.push(resp.results)
					} else {
						params = {
							...params,
							database_id: config.notion_dbs[type],
							filter_properties: ["title"]
						}
						resp = await limiter.schedule(() => notion.databases.query(params))
						rows.push(resp.results)
					}

					hasMore = resp.has_more
					if (resp.next_cursor) {
						token = resp.next_cursor
					}
				} catch (error) {
					if (400 <= error.status && error.status <= 409) {
						// Don't retry for errors 400-409
						bail(error)
						return
					}

					if (
						error.status === 500 ||
						error.status === 503 ||
						error.status === 504
					) {
						// Retry on 500, 503, and 504
						throw error
					}

					// Don't retry for other errors
					bail(error)
				}
			},
			{
				retries: 2,
				onRetry: (error, attempt) => {
					console.log(`Attempt ${attempt} failed. Retrying...`)
				},
			}
		)
	}

	return rows
}

/* Use Fuse to find the closest match to the provided value. */
function closestMatch(val, arr, keys) {
	// Set the Fuse options
	const options = {
		keys: keys || ["name"],
		includeScore: true,
		threshold: config.search_threshold,
	}

	// Create a new Fuse object
	const fuse = new Fuse(arr, options)

	// Search for the closest match
	const result = fuse.search(val)

	if (result.length === 0) {
		return "Not included."
	} else {
		return result[0].item
	}
}

export default defineComponent({
  props: {
    notion: {
      type: "app",
      app: "notion",
    }
  },
  async run({steps, $}) {
		// Check that the user configured the minimum settings from the previous step
		if (!steps.notion_tasks_settings.$return_value.tasks_db_id) {
			throw new Error('Tasks database is required to be set. Please choose a tasks database in the previous step.')
		}

		if (!steps.notion_tasks_settings.$return_value.tasks_name) {
			throw new Error('Task Name property is required to be set. Please set a Task Name property in the previous step.')
		}

		// Update the config with step information
		config.notion_dbs.tasks = steps.notion_tasks_settings.$return_value.tasks_db_id
		config.notion_dbs.projects = steps.notion_tasks_settings.$return_value.tasks_project.relation.database_id ?? ""

    // Initialize the Notion SDK
    const notion = new Client({ auth: this.notion.$auth.oauth_access_token })

    const matchedResponse = await getClosestNotionMatch(
      steps.Validate_ChatGPT_response.$return_value, 
      notion
    )
    return matchedResponse
  },
})
