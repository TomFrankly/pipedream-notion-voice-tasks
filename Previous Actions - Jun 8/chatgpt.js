import { Configuration, OpenAIApi } from "openai"
import { encode } from "gpt-3-encoder"

// Set the configs
const config = {
  maxtokens: 2000,
  model: "gpt-3.5-turbo",
}

async function parseTaskWithGPT(inputJSON, configuration) {
	
  // Initialize the openai object
  const openai = new OpenAIApi(configuration)
  
  // Construct the task prompt with the date for relative due-date setting, and set the name
	const task = `Today is ${inputJSON.date}. ${inputJSON.task}`
	const name = inputJSON.name

	// Set the max number of tokens a task can contain
	const maxTokens = config.maxtokens

	// Check the number of tokens in the task
	const tokens = encode(task)
	if (tokens.length > maxTokens) {
		throw new Error(
			`Task is too long. Max tokens: ${maxTokens}. Task tokens: ${tokens.length}`
		)
	}

	// Construct the system message
	const systemMessage = `You are a natural language processor for a task management app. Your job is to take natural-language prompts and turn them into tasks. 

    You should look for task name, due date, assignee, and project. If due date or project is not present in each task's sentence, don't include it, and do not include a property for it.
    
    Pay extra attention to this instruction: When you isolate a part of the prompt that represents a task, look for the word "project". If "project" is not present, do not include a project property for that task. If "project" is present, create a project property, but do not include the word "project" in its value.

	  Example: "studio design project" would equate to "project: studio design".
    
    Return dates in ISO 8601 format. If there are multiple tasks mentioned, return them as an array. If a task contains more than one date, identify the date that should be the due date. For example, the task, "I need to book a dinner for Thursday next week and I need to do that before the end of Friday" should have its due date set as Friday, not Thursday next week (in ISO 8601 format, with respect to today's date).
    
    Pay extra attention to this instruction: There must always be an assignee. If a sentence contains "I need to", set the assignee for that sentence's task as "${name}". If a sentence contains "I", "me", or other self-assigning language, and you think the speaker is assigning a task to themselves, set the assignee for that sentence's task as "${name}".
    
    You only speak in JSON. Do not write text that isn't JSON.
    
    Example prompt:
    
    "Tony needs to mount the new hair light by Saturday for the music video shoot project, I need to sweep out the garage by next Tuesday, Marissa needs to book a flight to Seattle for the team retreat project, and I need to talk to Dave about new sponsors."
    
    Example formatting:
    
    [
      {
        "task_name": "Mount new hair light",
        "due_date": "2023-05-06",
        "assignee": "Tony",
        "project": "Music video shoot"
      },
      {
        "task_name": "Sweep out the garage",
        "due_date": "2023-05-09",
        "assignee": "${name}"
      },
      {
        "task_name": "Book flight to Seattle",
        "assignee": "Marissa",
        "project": "Team Retreat"
      },
      {
        "task_name": "Talk to Dave about new sponsors",
        "assignee": "${name}"
      }
    ]`

	// Send the task prompt and system message to OpenAI
	try {
		const response = await openai.createChatCompletion({
			model: config.model,
			messages: [
				{ role: "system", content: systemMessage },
				{ role: "user", content: task },
			],
		})

		// Return the response
		return response
	} catch (error) {
    throw new Error(
			`Encountered an error when trying to send data to OpenAI: ${error}.`
		)
	}
}

export default defineComponent({
  props: {
    openai: {
      type: "app",
      app: "openai",
    }
  },
  async run({steps, $}) {
    // Initialize OpenAI
    const configuration = new Configuration({
      apiKey: this.openai.$auth.api_key,
    })
    
    const parsedTask = await parseTaskWithGPT(steps.Validate_user_message.$return_value, configuration)
    return parsedTask
  },
})