import{Client as e}from"@notionhq/client";import t from"bottleneck";import o from"fuse.js";import a from"openai";import{encode as s}from"gpt-3-encoder";import r from"joi";import i from"validator";import n from"dayjs";import l from"emoji-regex";import{jsonrepair as c}from"jsonrepair";import d from"axios";import p from"async-retry";let config={notion_dbs:{tasks:{id:""},projects:{id:""}},default_workflow_source:"",maxtokens:500,model:"",system_messages:{user_name:"",async round_1(){let u=`You are a task separator. Your separate user input into a JSON array of task strings. Do not rewrite user input. Just separate it, looking for words like "and", commas, or distinct sentences as separators.

Keep due date references with their original task.

Examples:

Input: I need to prepare slides for Wednesday's team meeting by tomorrow.

Output: ["I need to prepare slides for Wednesday's team meeting by tomorrow."]

Input: Today I need to schedule a dentist appointment, and Carl needs to pick up materials for the e-commerce project by tomorrow at 5pm. Also, Linda must finish her report for the sustainability project by next Monday, and I have to prepare for the Wednesday team meeting. Don't forget, Paul needs to order new computers for the IT upgrade project by this Friday.

["Today I need to schedule a dentist appointment", "Carl needs to pick up materials for the e-commerce project by tomorrow at 5pm", "Linda must finish her report for the sustainability project by next Monday", "I have to prepare for the Wednesday team meeting", "Paul needs to order new computers for the IT upgrade project by this Friday."]

You only write JSON. Do not write text that isn't valid JSON.`;return null!==this.remote&&this.remote?.round_1!==void 0?this.remote.round_1.replace("'{user_name}'",this.user_name):u},async round_2(){let u=`Your are a task analyzer. Your job is to analyze an array of tasks, and for each task, set a due_date_confidence property with a value of either Low or High.

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

You only write JSON. Do not write text that isn't JSON.`;return null!==this.remote&&this.remote?.round_2!==void 0?this.remote.round_2.replace("'{user_name}'",this.user_name):u},async round_3(){let u=`As a task parser, convert task objects from natural language to JSON. Extract task name, due date (if due_date_confidence is 'High' or 'Medium'), assignee, and if contains_project is present, project from each task. Omit missing details.
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

Critical: You only write JSON. Do not write text that isn't JSON.`;return null!==this.remote&&this.remote?.round_3!==void 0?this.remote.round_3.replace("'{user_name}'",this.user_name):u},async gpt4_system(){let u=`As a task parser, convert task objects from natural language to JSON. Extract task name, due date, assignee, and project from each task (if the word "project" is present). Omit missing details.
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

Critical: You only write JSON. Do not write text that isn't JSON.`;return null!==this.remote&&this.remote?.gpt_4!==void 0?this.remote.gpt_4.replace("'{user_name}'",this.user_name):u}}};export default{name:"Notion Voice Tasks –\xa0Core",description:"Uses ChatGPT to parse the details from transcribed voice tasks, then sends them to Notion.",key:"notion-voice-tasks",version:"0.0.3",type:"action",props:{openai:{type:"app",app:"openai",description:`⬆ Don't forget to connect your OpenAI account! I also recommend setting your [OpenAI Hard Limit](https://platform.openai.com/account/billing/limits) to a lower value, such as $10; you likely don't need it to be the default of $120/mo.

**Note:** If you're currently using OpenAI's free trial credit, you'll need generate a new API key and enter it here once you enter your billing information at OpenAI; once you do that, keys created during your trial period stop working.

## Overview

This workflow lets you create new tasks in Notion from your phone, **using your voice**. 

It also includes some advanced features:

* You can create multiple tasks in a single voice prompt
* Relative due dates are supported (e.g. "by *next Friday*")
* You can mention assignees and projects, which the workflow will attempt to intelligently match to existing Notion users and projects

**Need help with this workflow? [Check out the full instructions and FAQ here.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/)**

## Compatibility

This workflow will work with any Notion database.

### Upgrade Your Notion Experience

While this workflow will work with any Notion database, it's even better with a template.

For general productivity use, you'll love [Ultimate Brain](https://thomasjfrank.com/brain/) – my all-in-one second brain template for Notion. 

Ultimate Brain brings tasks, notes, projects, and goals all into one tool. Naturally, it works very well with this workflow.

**Are you a creator?** 

My [Creator's Companion](https://thomasjfrank.com/creators-companion/) template includes a ton of features that will help you make better-performing content and optimize your production process. There's even a version that includes Ultimate Brain, so you can easily use this workflow to create tasks related to your content.

*P.S. – This free workflow took 3 months to build. If you'd like to support my work, buying one of my templates is the best way to do so!*

## Instructions

[Click here for the full instructions on setting up this workflow.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#instructions)

### Mobile App Setup

You can create voice tasks with this workflow on iOS, MacOS, and Android.

* For MacOS and iOS (iPhone, iPad), we'll use the **Shortcuts** app. [Click here to access my shared workflow and instructions.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#ios)
* For Android, we'll use the **Tasker** app ($3.49 USD, one-time). [Click here to access my shared workflow and instructions.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#android) *At this time, I know of no free app for Android that can handle this workflow.*

Once you've set up the workflow on your phone, run it once to send a Test Event to this Pipedream workflow.

*Technically, you can also create tasks via any tool that will let you make an HTTP request with a JSON body. [See the full blog post for instructions on this.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#http-generic)*

## Creating Tasks

When creating tasks, you'll get the best results when you follow a couple of simple rules:

1. For due dates, say "by [date]" or "due [date]" at the end your task phrase. *E.G. "I need to finish planning the team retreat **by Friday**.*
2. For projects, you must use the word **"project"**. *E.G. "Tony needs to mount the audio foam **for the studio design project** by next Tuesday.*

Beyond that, this workflow is pretty flexible! Note that you can add multiple tasks in a single voice command. Example:

*"I need to finish my video script by Tuesday and Brian needs to create the environment model in Blender by July 30 and Tony needs to upload the green screen test footage by tomorrow."*

## FAQs

Below you'll find links that answer frequently asked questions about this workflow.

* [Cost FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#cost)
* [Privacy FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#privacy)
* [Security FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#security)
* [Code FAQs and GitHub Repo](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#code)
* [Support FAQs](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#support)

## More Resources

**More automations you may find useful:**

* [Send Voice Note Transcriptions and Summaries to Notion](https://thomasjfrank.com/how-to-transcribe-audio-to-text-with-chatgpt-and-notion/)
* [Notion to Google Calendar Sync](https://thomasjfrank.com/notion-google-calendar-sync/)

**All My Notion Automations:**

* [Notion Automations Hub](https://thomasjfrank.com/notion-automations/)

**Want to get notified about updates to this workflow (and about new Notion templates, automations, and tutorials)?**

* [Join my Notion Tips newsletter](https://thomasjfrank.com/fundamentals/#get-the-newsletter)`},steps:{type:"object",label:"Previous Step Data (Set by Default)",description:"This property simply passes data from the previous step(s) in the workflow to this step. It should be pre-filled with a default value of **{{steps}}**, and you shouldn't need to change it."},notion:{type:"app",app:"notion",description:"Connect your Notion account. When setting up the connection, be sure to grant Pipedream access to your Task and Project databases, or to a page that contains them."},databaseID:{type:"string",label:"Tasks Database",description:"Select your tasks database. *If you don't see your database here, try waiting 1-2 minutes and then refreshing the page. If that doesn't work, [please read this FAQ section](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#missing-database).*",async options(u){let{query:h,prevContext:f}=u;if(!this.notion)return{options:["Please connect your Notion account first."]};try{let t=new e({auth:this.notion.$auth.oauth_access_token}),o=f?.cursor,a=await t.search({...h?{query:h}:{},...o?{start_cursor:o}:{},page_size:50,filter:{value:"database",property:"object"},sorts:[{direction:"descending",property:"last_edited_time"}]}),s=a.results.filter(e=>e.title?.[0]?.plain_text.includes("All Tasks")),r=a.results.filter(e=>!e.title?.[0]?.plain_text.includes("All Tasks")),i=[...s,...r],n=/All Tasks/,l=/All Tasks \[\w*\]/,c=i.map(e=>({label:l.test(e.title?.[0]?.plain_text)?e.title?.[0]?.plain_text+" – (used for Ultimate Brain)":n.test(e.title?.[0]?.plain_text)?e.title?.[0]?.plain_text+" – (used for Ultimate Tasks)":e.title?.[0]?.plain_text,value:e.id}));return{context:{cursor:a.next_cursor},options:c}}catch(e){return console.error(e),{context:{cursor:null},options:[]}}}},secretKey:{type:"string",label:"Secret Key [TYPE THIS MANUALLY]",description:`**MANUALLY TYPE a secret key** that matches the secret key from your iOS/Android shortcut exactly. *Do NOT use the dropdown to select a path here.*

**Important: This workflow is provided for free, as-is, and without warranty. Use this workflow at your own risk. Make sure to keep your trigger URL (shown in the trigger step above) and this secret key SECRET. Treat both like passwords. I also recommend setting your [OpenAI Hard Limit](https://platform.openai.com/account/billing/limits) to a lower amount, such as $10 (normal use of this workflow costs around $0.003 per run, so your use shoudl never even come close to that).**

As long as you don't share your trigger URL and secret key with unauthorized people, this workflow is safe to use. [You can read all of the security info here](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#security).

**Here's how this secret key feature works:**

When your workflow receives a new request, the secret key in the request body will be compared against the key you have entered here. If they match, the workflow will continue.

This prevents others from sending requests to your workflow, even in the rare event that they knew your request URL.

**Example:** if your secret key in your mobile app shortcut is "welcometocostco", set "welcometocostco" here.

**Important: Do not share this key, nor your unique trigger URL, with anyone you don't trust.**`,secret:!0,reloadProps:!0}},async additionalProps(){let u,h;if(this.openai)try{let e=new a({apiKey:this.openai.$auth.api_key}),t=await e.models.list();u=t.data.filter(e=>e.id.includes("gpt")&&!e.id.endsWith("0301")&&!e.id.endsWith("0314"))}catch(e){console.error(`Encountered an error with OpenAI: ${e} – Please check that your API key is still valid.`)}if(!this.databaseID)return{};let f=new e({auth:this.notion.$auth.oauth_access_token}),y=await f.databases.retrieve({database_id:this.databaseID}),m=y.properties,g=!!m.hasOwnProperty("Kanban Status"),k=!!m.hasOwnProperty("Priority");m.hasOwnProperty("Smart List");let _=" (REQUIRED for Ultimate Brain/Ultimate Tasks)",b=Object.keys(m).filter(e=>"title"===m[e].type),w=Object.keys(m).filter(e=>"date"===m[e].type),v=Object.keys(m).filter(e=>"people"===m[e].type),T=Object.keys(m).filter(e=>"relation"===m[e].type),j=Object.keys(m).filter(e=>"select"===m[e].type),x=Object.keys(m).filter(e=>"status"===m[e].type);function S(e,t){let o=[t].concat(e).filter((e,t,o)=>o.indexOf(e)===t);return o.map(e=>({label:e,value:e}))}let P=j.concat(x),N={};if(this.project){let e=await f.databases.retrieve({database_id:m[this.project].relation.database_id});h=e.properties,config.notion_dbs.projects.id=m[this.project].relation.database_id,config.notion_dbs.projects.properties=h;let t={status:["status","select"],date:["date","last_edited_time","created_time"],checkbox:["checkbox"]};N.status=Object.keys(h).filter(e=>t.status.includes(h[e].type)),N.date=Object.keys(h).filter(e=>t.date.includes(h[e].type)),N.checkbox=Object.keys(h).filter(e=>t.checkbox.includes(h[e].type))}let I={taskName:{type:"string",label:"Task Name (Required)",description:"Select the title property for your tasks.",options:b.map(e=>({label:e,value:e})),optional:!1},dueDate:{type:"string",label:"Due Date",description:"Select the date property for your tasks.",options:w.map(e=>({label:e,value:e})),optional:!0},assignee:{type:"string",label:"Assignee",description:"Select the person property for your tasks.",options:v.map(e=>({label:e,value:e})),optional:!0},project:{type:"string",label:"Project",description:"Select the relation property for your tasks.",options:T.map(e=>({label:e,value:e})),optional:!0,reloadProps:!0},status:{type:"string",label:"Status",description:"Select the default status property for your tasks.",options:x.map(e=>({label:e,value:e})),optional:!0,reloadProps:!0},source:{type:"string",label:"Source",description:"Select the source property for your tasks (must be a Select property). Use this if you want to track how your tasks were created - e.g. \"iOS Voice Shortcut\". Once selected, you'll then be able to set the actual value in the Source Value field below. Note: Even if you don't use this, your Created By property's value (if you have that property in your database) for each task will be Pipedream, meaning you can easily find tasks created through this workflow using that property value.",options:j.map(e=>({label:e,value:e})),optional:!0,reloadProps:!0},priority:{type:"string",label:`Priority${k?_:""}`,description:`Select the Priority property${k?_:". Typically only used by Ultimate Tasks/Ultimate Brain users."}

If you don't see the Priority Value option come up after selecting a value here, please hit **Refresh Fields** below.`,options:S(P,"Priority"),optional:!k,reloadProps:!0},kanban_status:{type:"string",label:`Kanban Status${g?_:""}`,description:`Select the Kanban Status property${g?_:". Typically only used by Ultimate Tasks/Ultimate Brain users."}

If you don't see the Kanban Status Value option come up after selecting a value here, please hit **Refresh Fields** below.`,options:S(P,"Kanban Status"),optional:!g,reloadProps:!0},advanced_options:{type:"boolean",label:"Enable Advanced Options",description:"Set this to **True** to enable advanced options for this workflow, including Project database filtering, fuzzy search sensitivity, and more.",default:!1,optional:!0,reloadProps:!0},...j.concat(x).includes("Smart List")&&{smart_list:{type:"string",label:"Smart List",description:"Select your Smart List property. Typically only used by Ultimate Brain users who use the Process (GTD-style) dashboard",options:j.concat(x).filter(e=>"Smart List"===e).map(e=>({label:e,value:e})),optional:!0,reloadProps:!0}},...this.source&&{source_value:{type:"string",label:`Source Value (for chosen propety: ${this.source})`,description:"Type or select a value for your chosen Source property.",options:this.source?m[this.source].select.options.map(e=>({label:e.name,value:e.name})):[],default:"iOS Voice Shortcut",optional:!0}},...this.project&&!0===this.advanced_options&&{fuzzy_search_threshold:{type:"integer",label:"Project-matching Search Score Threshold",description:`The projects named in your input are matched against project pages in the Projects database connected to your ${this.project} Relation property. Fuzzy search is used to match the right project, even if you didn't say the name exactly right. You can adjust this value to make the matching more or less strict. A score of 0 will require an exact match; a score of 100 will match the nearest Project, no matter how different it is. The default is 40, which is generally effective. I typically don't recommend setting the score higher, but you can set it lower if you find that your tasks are getting matched to the wrong projects. It's much better for a task to get NO matched Project (and therefore ideally be sent to your Inbox) than for it to be matched with the wrong project.`,default:40,optional:!0},database_filter_status:{type:"string",label:`Project Status Filter (for chosen Relation: ${this.project})`,description:'Status or Select property to use as a filter for the Projects database. Once you select a property here, you\'ll get a new field to select the value you want to filter by. For example, you could select a Status-type property here, then select "In Progress" as the value to filter by.',options:N?.status?.map(e=>({label:e,value:e})),optional:!0,reloadProps:!0},database_filter_checkbox:{type:"string",label:`Project Checkbox Filter (for chosen Relation: ${this.project})`,description:"Checkbox property to use as a filter for the Projects database. Once you select a property here, you'll get a new field to select the value you want to filter by. For example, you could select a Checkbox-type property here, then select true as the value to filter by.",options:N?.checkbox?.map(e=>({label:e,value:e})),optional:!0,reloadProps:!0},database_filter_date:{type:"string",label:`Project Date Filter (for chosen Relation: ${this.project})`,description:"Date, Created Time, or Last Edited Time property to use as a recency filter for the Projects database. Once you select a property here, you'll get a new field to select a number of days you want to filter by. For example, you could select a Last Edited Time-type property here, then select 7 days as the value to filter by. This would return projects that were last edited within the last 7 days.",options:N?.date?.map(e=>({label:e,value:e})),optional:!0,reloadProps:!0}},...this.status&&{status_value:{type:"string",label:`Status Value (for chosen propety: ${this.status})`,description:"Choose a value for your chosen Status property. If you don't choose a Status property, your database's default value will be used.",options:this.status?m[this.status].status.options.map(e=>({label:e.name,value:e.name})):[],optional:!0}},...this.kanban_status&&{kanban_status_value:{type:"string",label:`Kanban Status Value${g?_:""} – (for chosen property: ${this.kanban_status})`,description:`Choose a value for your Kanban Status property${g?_+".":"."}`,options:this.kanban_status?m[this.kanban_status][m[this.kanban_status]?.type].options.map(e=>({label:e.name,value:e.name})):[],optional:!this.kanban_status||!g}},...this.priority&&{priority_value:{type:"string",label:`Priority Value${k?_:""} – (for chosen property: ${this.priority})`,description:`Choose a value for your Priority property${k?_+".":"."}`,options:this.priority?m[this.priority][m[this.priority]?.type].options.map(e=>({label:e.name,value:e.name})):[],optional:!this.priority||!k}},...this.smart_list&&{smart_list_value:{type:"string",label:`Smart List Value (for chosen property: ${this.smart_list})`,description:"Choose a value for your Smart List property. If you don't choose one, Smart List will be ignored.",options:this.smart_list?m[this.smart_list][m[this.smart_list]?.type].options.map(e=>({label:e.name,value:e.name})):[],optional:!0}},...this.database_filter_status&&{database_filter_status_value:{type:"string[]",label:`Projects Database Status/Select Filter Value (chosen property: ${this.database_filter_status})`,description:'The value(s) to filter by for the Status/Select property. You can select multiple values here (e.g. "In Progress" and "Not Started").',options:this.database_filter_status?h[this.database_filter_status][h[this.database_filter_status].type].options.map(e=>({label:e.name,value:e.name})):[],optional:!0}},...this.database_filter_checkbox&&{database_filter_checkbox_value:{type:"boolean",label:`Projects Database Checkbox Filter Value (chosen property: ${this.database_filter_checkbox})`,description:"The value to filter by for the Checkbox property.",optional:!0}},...this.database_filter_date&&{database_filter_date_value:{type:"integer",label:`Projects Database Date Filter Value (chosen property: ${this.database_filter_date})`,description:"The number of days since today to filter by for the Date, Created Time, or Last Edited Time property. For example, if you select 7 here, the filter will return projects where your selected Date, Created Time, or Last Edited Time property's value is within the last 7 days.",optional:!0}},...this.openai&&{chat_model:{type:"string",label:"ChatGPT Model",description:`Select the model you would like to use.

Defaults to **gpt-3.5-turbo**, which is recommended for this workflow. You can also use **gpt-4**, which may allow you to speak more "loosely" while retaining accuracy in task parsing. However, it will also increase the average cost of each workflow run by ~7.5x.`,default:"gpt-3.5-turbo",options:u.map(e=>({label:e.id,value:e.id})),optional:!0}},...this.openai&&!0===this.advanced_options&&{send_response:{type:"boolean",label:"Send Response on Completion?",description:`Set this to **true** if you would like to receive a response on your device when this workflow successfully completes.

The response will tell you:
* How many tasks were created
* How long the operation took
* How much the operation cost

**Note:** In the case of an error, this workflow will send you an email with both the task details you spoke into your phone and the error details.

For certain errors, a fallback routine will send a single task to Notion containing everything you said as well.

For this reason, you can set this to **false** to simply send a generic response right away, which will help the workflow feel faster to use (especially since ChatGPT can often take 20-30 seconds to fully process all operations).`,default:!1,optional:!0}},...!0===this.advanced_options&&{remove_midnight:{type:"boolean",label:"Remove Mightnight (00:00) Due Times",description:`Set this to **true** if you would like to remove the due time from tasks that have a due time of midnight (00:00).

The ChatGPT system instructions have been written so that tasks without a due time should not have one in the due date property, but sometimes ChatGPT ignores this instruction and applies a due time of 00:00.

By enabling this feature, that 00:00 due time will be stripped out before your task is sent to Notion.`,default:!1,optional:!0}},...this.openai&&!0===this.advanced_options&&{update_system:{type:"string",label:"System Message Source",description:`Set to **Auto-Update** if you want the your workflow to fetch the latest versions of the system messages (instructions for ChatGPT) I've written.

System messages tell the model how to behave and how to handle the user's prompt.

This setting allows for using updated system messages in the event that better ones are discovered or bugs are discovered in the hard-coded ones (without you having to recreate the entire workflow).

[You can read the system messages here](https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/).

If this is set to **Hard-Coded**, or if the request to that URL fails/takes more than 2 seconds, the script will fall back to the system message that are hard-coded into this workflow.

If you would like to use your own system messages, select **Write Your Own (Advanced)** and then add your custom URL to the **System Message URL** property below. [Read the full instructions on this use case here.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#custom-system)`,options:["Auto-Update","Hard-Coded","Write Your Own (Advanced)"],optional:!0,default:"Auto-Update",reloadProps:!0}},..."Write Your Own (Advanced)"===this.update_system&&{system_message_url:{type:"string",label:"System Message URL",description:`The URL where your custom system messages are hosted.

*Writing your own system messages is an advanced use case, is not recommended for most users, and will not be supported in any way. If you do write your own system messages, you should [copy mine](https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/) and make minor adjustments.The system messages must be a JSON object with a particular structure, and large changes will likely break this workflow.*`,optional:!0,default:"https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/"}}};return I},methods:{async chatGTPHandler(u){let h=new Date(u.trigger.context.ts),f=h.getTime();this.chat_model?config.model=this.chat_model:config.model="gpt-3.5-turbo";let y=await this.validateUserInput(u.trigger.event.body);if(await this.moderationCheck(JSON.stringify(y)),config.system_messages.user_name=y.name,await this.fetchPrompts(),config.model.includes("gpt-4")){console.log("GPT-4 selected. Initiating 1-round task processing.");let e=await this.parseTaskWithGPT(y,await config.system_messages.gpt4_system(),3,y.task),t=await this.calculateGPTCost(e.usage,e.model),o=await this.validateChatGPTResponse(e.choices[0].message.content);console.log("Response Validated. Validated Response:"),console.log(o);let a=this.refineTasks(o);console.log("Response Refined. Refined response: "),console.log(a);let s={start_timestamp:f,validated_body:y,cost:t,model:e.model,validated_response:o,final_response:a,full_response:e};return s}{let e=await this.parseTaskWithGPT(y,await config.system_messages.round_1(),1),t=await this.calculateGPTCost(e.usage,e.model),o=await this.validateChatGPTResponse(e.choices[0].message.content);console.log("Round One Validated. Validated Response:"),console.log(o);let a=await this.parseTaskWithGPT(y,await config.system_messages.round_2(),2,JSON.stringify(o)),s=await this.calculateGPTCost(a.usage,a.model),r=await this.validateChatGPTResponse(a.choices[0].message.content);console.log("Round Two Validated.");let i=this.detectProjects(r),n=await this.parseTaskWithGPT(y,await config.system_messages.round_3(),3,JSON.stringify(i)),l=await this.calculateGPTCost(n.usage,n.model),c=await this.validateChatGPTResponse(n.choices[0].message.content);console.log("Round Three Validated.");let d=this.refineTasks(c);console.log("Round Three Refined. Refined response: "),console.log(d);let p={start_timestamp:f,validated_body:y,cost:t+s+l,model:e.model,validated_response_1:o,validated_response_2:r,detected_projects_response:i,validated_response_3:c,final_response:d,full_responses:{round_one:e,round_two:a,round_three:n}};return p}},async validateUserInput(u){if(!u.secret||u.secret!==this.secretKey){let e=Error("Secret key in the request does not match the key configured in the workflow settings. The secret key used in this request was: "+u.secret);await this.createFallbackTask(e,!0,"config")}let h=r.object({task:r.string().custom((e,t)=>{let o=RegExp("^[a-zA-Z0-9\xc0-\xd6\xd8-\xf6\xf8-\xff.,!?;$'\"&#:“”’\\-–— ]*$");return o.test(e)||l().test(e)?e:t.message("Task must only contain letters, numbers, emoji, and punctuation.")}).required(),name:r.string().max(50).message("Name must be 50 characters or less.").required(),date:r.string().custom((e,t)=>/(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?([+-]([01]\d|2[0-3]):[0-5]\d|Z)?)/.test(e)?e:t.message("Date must be a string in ISO 8601 format.")).message("Date must be a string in ISO 8601 format.").required()}),f=i.escape(u.date);if(!n(f).isValid()){let e=Error(`Invalid date format. Date object currently is formatted as: ${f}. Please use ISO 8601 format.`);await this.createFallbackTask(e,!0,"chatgpt")}u.task=u.task.replace(/\n/g," ");let y={task:i.escape(u.task),name:i.escape(u.name),date:f};console.log("Date before Joi: "+y.date);let{error:m,value:g}=h.validate(y);if(m){let e=Error(`Joi error: ${m}`);await this.createFallbackTask(e,!0,"chatgpt")}return console.log("Validated Joi Object"),console.log(g),g},async parseTaskWithGPT(u,h,f,y){let m;m="number"==typeof f?f.toString():f;let g={1:u.task,2:y,3:`Today is ${u.date}. ${y}`},k=config.maxtokens,_=new a({apiKey:this.openai.$auth.api_key}),b=s(g[m]);if(b.length>k){let e=Error(`Task is too long. Max tokens: ${k}. Task tokens: ${b.length}`);await this.createFallbackTask(e,!0,"chatgpt")}try{return p(async(e,t)=>{console.log(`Attempt number ${t} to send prompt to OpenAI.`);try{let e=await _.chat.completions.create({model:config.model,messages:[{role:"system",content:h},{role:"user",content:g[m]}],temperature:0});return e}catch(t){throw console.error(`An error occurred: ${t.message}`),t.response&&(console.error(`Response status: ${t.response.status}`),console.error(`Response data: ${JSON.stringify(t.response.data)}`)),(!t.response||t.response.status<500||t.response.status>=600)&&e(t),t}},{retries:2,minTimeout:1e3,factor:2})}catch(t){let e=Error(`Error sending prompt to OpenAI: ${t}`);await this.createFallbackTask(e,!0,"chatgpt")}},async calculateGPTCost(u,h){if(!u||"object"!=typeof u||!u.prompt_tokens||!u.completion_tokens){let e=Error("Invalid usage object (thrown from calculateGPTCost).");await this.createFallbackTask(e,!0,"chatgpt")}if(!h||"string"!=typeof h){let e=Error("Invalid model string (thrown from calculateGPTCost).");await this.createFallbackTask(e,!0,"chatgpt")}let f={"gpt-3.5-turbo":{prompt:.0015,completion:.002},"gpt-3.5-turbo-16k":{prompt:.003,completion:.004},"gpt-4":{prompt:.03,completion:.06},"gpt-4-32k":{prompt:.06,completion:.12}},y=h.includes("gpt-4-32")?"gpt-4-32k":h.includes("gpt-4")?"gpt-4":h.includes("gpt-3.5-turbo-16k")?"gpt-3.5-turbo-16k":"gpt-3.5-turbo";if(!f[y]){let e=Error("Non-supported model. (thrown from calculateGPTCost).");await this.createFallbackTask(e,!0,"chatgpt")}let m={prompt:u.prompt_tokens/1e3*f[y].prompt,completion:u.completion_tokens/1e3*f[y].completion,get total(){return this.prompt+this.completion}};return m.total},async validateChatGPTResponse(u){let h;try{h=JSON.parse(u),console.log("Response Array is valid JSON.")}catch{try{console.log("Attempting JSON repair...");let e=await this.repairJSON(u);h=JSON.parse(e)}catch{let e=Error("Invalid JSON response from ChatGPT.");await this.createFallbackTask(e,!0,"chatgpt")}}return console.log("Response Array has a type of: "+typeof h),console.log("Response Array:"),console.log(h),h},async repairJSON(u){let h=Math.min(-1!==u.indexOf("{")?u.indexOf("{"):1/0,-1!==u.indexOf("[")?u.indexOf("["):1/0),f=Math.max(-1!==u.lastIndexOf("}")?u.lastIndexOf("}"):-1/0,-1!==u.lastIndexOf("]")?u.lastIndexOf("]"):-1/0);if(h==1/0||-1==f){let e=Error("No JSON object or array found (in repairJSON).");await this.createFallbackTask(e,!0,"chatgpt")}try{let e=c(u.substring(h,f+1));return e}catch(t){let e=Error(`JSON repair error: ${t}`);await this.createFallbackTask(e,!0,"chatgpt")}},refineTasks(u){for(let e of(console.log("Refining final response..."),u)){e.project&&console.log("Project for this task is "+e.project);let t=/\sfor\s.*?project$/gi,o=/\sproject$/i;t.test(e.task_name)&&(e.task_name=e.task_name.replace(t,"")),e.project&&o.test(e.project)&&(console.log("Current project name: "+e.project),e.project=e.project.replace(o,"")),e.project&&e.project.charAt(0)===e.project.charAt(0).toLowerCase()&&(e.project=e.project.charAt(0).toUpperCase()+e.project.slice(1))}return u},detectProjects(u){let h=[];for(let e of u){let t={task_text:e.task_name,due_date_confidence:e.due_date_confidence,...e.task_name.includes("project")&&{contains_project:"Contains Project"}};h.push(t)}return h},async fetchPrompts(){if("boolean"==typeof this.update_system&&!1===this.update_system)console.log("System messages update disabled."),config.system_messages.remote=null;else try{let e=await d.get("https://thomasjfrank.com/mothership-pipedream-notion-voice-tasks/",{timeout:2e3});config.system_messages.remote=e.data.en,console.log("System messages fetched successfully.")}catch(e){console.log("System messages fetch failed."),console.error(e),config.system_messages.remote=null}},async moderationCheck(u){if(!u){let e=Error("Message cannot be empty or null.");await this.createFallbackTask(e,!0,"chatgpt")}let h=new a({apiKey:this.openai.$auth.api_key});try{return p(async(e,t)=>{console.log(`Moderation attempt number: ${t}`);try{let e=await h.moderations.create({input:u}),t=e.results[0].flagged;if(null==t){let e=Error("Moderation check failed. Request to OpenAI's Moderation endpoint could not be completed.");await this.createFallbackTask(e,!0,"chatgpt")}if(!0===t){let e=Error("Detected inappropriate content in the prompt.");await this.createFallbackTask(e,!0,"chatgpt")}else console.log("Prompt passed moderation check.")}catch(t){throw console.error(`An error occurred: ${t.message}`),t.response&&(console.error(`Response status: ${t.response.status}`),console.error(`Response data: ${JSON.stringify(t.response.data)}`)),(!t.response||t.response.status<500||t.response.status>=600)&&e(t),t}},{retries:2,minTimeout:1e3,factor:2})}catch(t){let e=Error(`Error sending moderation check to OpenAI: ${t}`);await this.createFallbackTask(e,!0,"chatgpt")}},setPropChoices(){config.properties={tasks_name:this.taskName,...this.dueDate&&{tasks_due_date:this.dueDate},...this.assignee&&{tasks_assignee:this.assignee},...this.project&&{tasks_project:config.notion_dbs.tasks.properties[this.project]},...this.source&&{tasks_source:this.source},...this.source_value&&{tasks_source_value:this.source_value},...this.status&&{tasks_status:config.notion_dbs.tasks.properties[this.status]},...this.status_value&&{tasks_status_value:this.status_value},...this.kanban_status&&{tasks_kanban_status:config.notion_dbs.tasks.properties[this.kanban_status]},...this.kanban_status_value&&{tasks_kanban_status_value:this.kanban_status_value},...this.priority&&{tasks_priority:config.notion_dbs.tasks.properties[this.priority]},...this.priority_value&&{tasks_priority_value:this.priority_value},...this.smart_list&&{tasks_smart_list:config.notion_dbs.tasks.properties[this.smart_list]},...this.smart_list_value&&{tasks_smart_list_value:this.smart_list_value},...this.fuzzy_search_threshold&&{tasks_fuzzy_search_threshold:this.fuzzy_search_threshold/100}},(this.database_filter_status_value||this.database_filter_checkbox_value||this.database_filter_date_value)&&(config.filters={...this.database_filter_status_value&&{status:{property:this.database_filter_status,value:this.database_filter_status_value,type:config.notion_dbs.projects.properties[this.database_filter_status].type}},...void 0!==this.database_filter_checkbox_value&&null!==this.database_filter_checkbox_value&&{checkbox:{property:this.database_filter_checkbox,value:this.database_filter_checkbox_value}},...this.database_filter_date_value&&{date:{property:this.database_filter_date,value:this.database_filter_date_value}}})},async getClosestNotionMatch(u,h){if("object"!=typeof u||null===u){let e=Error("Invalid JSON input.");await this.createFallbackTask(e,!0,"notion")}let f=[];for(let e of u){let t={task:e.task_name,assignee:e.assignee?await this.findNearestChoice(e.assignee,"assignee",h):"Not included.",due:e.due_date||"Not included.",due_end:e.due_date_end||"Not included.",...config.notion_dbs.projects.id&&{project:e.project?await this.findNearestChoice(e.project,"projects",h):"Not included."},full_text:e.full_task_details||"Not included."};for(let e in t)"Not included."===t[e]&&delete t[e];f.push(t)}return f},async findNearestChoice(u,h,f){let y=await this.queryNotion(h,f),m="assignee"===h?"user":"db",g=y.flat(),k=[];for(let e of g)("person"===e.type||"page"===e.object)&&k.push(e);let _=[];for(let e of k)try{let t="db"===m?e.properties.Name.title[0].plain_text:e.name,o={name:t,id:e.id};_.push(o)}catch(t){let e=Error(`Error creating item in choice array. This error occured when trying to find a match in Notion for ${u}.

Full error details:

${t}`);await this.createFallbackTask(e,!1,"notion")}let b=this.closestMatch(u,_);return b},async queryNotion(u,h){let f,y;let m=new t({minTime:333,maxConcurrent:1});m.on("error",e=>{let t=429===e.statusCode;if(t){console.log(`Job ${jobInfo.options.id} failed due to rate limit: ${e}`);let t=e.headers["retry-after"]?parseInt(e.headers["retry-after"],10):.4;return console.log(`Retrying after ${t} seconds...`),1e3*t}console.log(`Job ${jobInfo.options.id} failed: ${e}`)});let g=[];for(;void 0==f||!0==f;)try{await p(async e=>{let t;let o={page_size:100,start_cursor:y};try{"assignee"===u?t=await m.schedule(()=>h.users.list(o)):(o={...o,database_id:config.notion_dbs[u].id,filter_properties:["title"],...config.filters&&Object.keys(config.filters).length>=1&&{filter:this.getFilters()}},t=await m.schedule(()=>h.databases.query(o))),g.push(t.results),f=t.has_more,t.next_cursor&&(y=t.next_cursor)}catch(t){if(400<=t.status&&t.status<=409){e(t);return}if(500===t.status||503===t.status||504===t.status)throw t;e(t)}},{retries:2,onRetry:(e,t)=>{console.log(`Attempt ${t} failed. Retrying...`)}})}catch(t){let e=Error(`Error querying Notion to fetch ${u}. Creating fallback task.

Full error details:

${t}`);await this.createFallbackTask(e)}return g},closestMatch(u,h,f){let y={keys:f||["name"],includeScore:!0,threshold:this.tasks_fuzzy_search_threshold?this.tasks_fuzzy_search_threshold:.4},m=new o(h,y),g=m.search(u);return 0===g.length?"Not included.":g[0].item},getFilters(){let u={and:[]};if(void 0!==config.filters.checkbox.value&&null!==config.filters.checkbox.value&&u.and.push({property:config.filters.checkbox.property,checkbox:{equals:config.filters.checkbox.value}}),config.filters.date.value){let e=new Date(config.original_body.date),t=new Date(e.getTime()-864e5*config.filters.date.value);t.setHours(0,0,0,0);let o=t.toISOString(),a=config.notion_dbs.projects.properties[config.filters.date.property].type;"date"===a?u.and.push({property:config.filters.date.property,date:{on_or_after:o}}):("created_time"===a||"last_edited_time"===a)&&u.and.push({timestamp:a,[a]:{on_or_after:t}})}if(config.filters.status.value){let e=config.notion_dbs.projects.properties[config.filters.status.property].type,t=[];config.filters.status.value.forEach(o=>{t.push({property:config.filters.status.property,[e]:{equals:o}})}),u.and.push({or:t})}return u},formatChatResponse(u,h,f){return u.map(e=>this.creatNotionObject(e,h,f))},creatNotionObject(u,h){let f=arguments.length>2&&void 0!==arguments[2]?arguments[2]:"Pipedream",y=`$${h.toFixed(4)}`;if(!0===this.remove_midnight&&u.due){let e=/T00:00:00(\.\d+)?[+-]\d{2}:\d{2}$/;e.test(u.due)&&(console.log("Midnight time part removed from result.due"),u.due=u.due.replace(e,""))}if(!0===this.remove_midnight&&u.due_end){let e=/T00:00:00(\.\d+)?[+-]\d{2}:\d{2}$/;e.test(u.due_end)&&(console.log("Midnight time part removed from result.due_end"),u.due_end=u.due_end.replace(e,""))}return{parent:{database_id:config.notion_dbs.tasks.id},properties:{[config.properties.tasks_name]:{title:[{text:{content:u.task}}]},...config.properties.tasks_source_value&&{[config.properties.tasks_source]:{select:{name:config.properties.tasks_source_value}}},...config.properties.tasks_status_value&&{[config.properties.tasks_status.name]:{status:{name:config.properties.tasks_status_value}}},...config.properties.tasks_kanban_status_value&&{[config.properties.tasks_kanban_status.name]:{[config.properties.tasks_kanban_status.type]:{name:config.properties.tasks_kanban_status_value}}},...config.properties.tasks_priority_value&&{[config.properties.tasks_priority.name]:{[config.properties.tasks_priority.type]:{name:config.properties.tasks_priority_value}}},...config.properties.tasks_smart_list_value&&{[config.properties.tasks_smart_list.name]:{[config.properties.tasks_smart_list.type]:{name:config.properties.tasks_smart_list_value}}},...u.assignee&&{[config.properties.tasks_assignee]:{people:[{id:u.assignee.id}]}},...u.due&&{[config.properties.tasks_due_date]:{date:{start:u.due,...u.due_end&&{end:u.due_end}}}},...u.project&&{[config.properties.tasks_project.name]:{relation:[{id:u.project.id}]}}},children:[{object:"block",type:"callout",callout:{icon:{emoji:"🤖"},color:"blue_background",rich_text:[{text:{content:`This task was created via the following source: ${f}. The cost of this request was ${y}.`}}]}},{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:"Full text of task:"},annotations:{bold:!0}}]}},{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:u.full_text}}]}},{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:"Entire request sent to ChatGPT:"},annotations:{bold:!0}}]}},{object:"block",type:"paragraph",paragraph:{rich_text:[{type:"text",text:{content:config.original_body.task}}]}}]}},async createTasks(u,h){try{let e=new t({maxConcurrent:1,minTime:333});e.on("error",e=>{let t=429===e.statusCode;if(t){console.log(`Job ${e.id} failed due to rate limit: ${e}`);let t=e.headers["retry-after"]?parseInt(e.headers["retry-after"],10):.4;return console.log(`Retrying after ${t} seconds...`),1e3*t}console.log(`Job ${e.id} failed: ${e}`)});let o=await Promise.all(u.map(t=>p(async o=>{try{let o=await e.schedule(()=>h.pages.create(t));return o}catch(e){if(400<=e.status&&e.status<=409)console.log("Error creating Notion task:",e),o(e);else throw console.log("Error creating Notion task:",e),e}},{retries:3,onRetry:e=>console.log("Retrying Notion task creation:",e)})));return o}catch(t){let e=Error(`Error creating task in Notion: ${t}`);await this.createFallbackTask(e,!0,"notion")}},async sendResponse(u,h,f,y){if(!0===this.sendResponse){let e=Date.now(),t=y.toFixed(4);await u.respond({status:200,headers:{},body:`Success! Created ${h} ${1===h?"task":"tasks"} in Notion.
					Operation took ${(e-f)/1e3} seconds and cost $${t} to complete.`})}else await u.respond({status:200,headers:{},body:"Task(s) has been sent to ChatGPT for processing."})},async checkBody(){for(let e of["task","name","date","secret"])if(!config.original_body[e]){let t=Error(`Missing property "${e}" in request body.`);await this.createFallbackTask(t,!0,"config")}if(config.original_body.secret!==this.secretKey){let e=Error("Secret key in the request does not match the key configured in the workflow settings. The secret key used in this request was: "+config.original_body.secret);await this.createFallbackTask(e,!0,"config")}if(this.kanban_status&&this.kanban_status_value.length<1)throw Error("Kanban Status Value property must have a value selected. If you don't see this property in the Configuration tab, please hit the Refresh Fields button.");if(this.priority&&this.priority_value.length<1)throw Error("Priority Value property must have a value selected. If you don't see this property in the Configuration tab, please hit the Refresh Fields button.");if(config.original_body.task.length>750){let e=config.pipedream;e.send.email({subject:`[Notion Voice Tasks] –\xa0Warning: Abnormally long task text`,text:`A request was sent to your Notion Voice Tasks workflow in Pipedream with task text over 750 characters.

If you or one or your authorized users sent this request, you can safely disregard this email.

Otherwise, please check your workflow history to check if an unauthorized party is sending requests to your workflow.

The full text of your request is:

${config.original_body.task}`})}},async createFallbackTask(u){let h=!(arguments.length>1)||void 0===arguments[1]||arguments[1],f=arguments.length>2&&void 0!==arguments[2]?arguments[2]:"notion",y=config.pipedream;"chatgpt"===f?console.log("ChatGPT failed to parse the user's request. Creating a fallback task in Notion and emailing the user..."):"notion"===f?console.log("Failed to create the task(s) in Notion. Sending error email to user..."):"config"===f?console.log("A configuration error occured. Sending error email to user..."):console.log("An error occurred. Sending error email to user...");let m={task:`[CHATGPT FAILED TO PARSE]: ${config.original_body.task}`,full_text:`${config.original_body.task} –\xa0(Task created by ${config.original_body.name} on ${config.original_body.date}.)`},g={chatgpt:{subject:`[Notion Voice Tasks] –\xa0ChatGPT Error`,body(){return`ChatGPT failed to process a request made via your Notion Voice Tasks workflow, sent by ${config.original_body.name} at ${config.original_body.date}.

The full text of your request is:

${config.original_body.task}

You can access the task that was created in Notion at ${this.task_url}.

The full error message is:

${u}`},http_response:`Partial failure. ChatGPT encountered an error, so one task was created in Notion containing all the details of your request as a fallback, and an email with more detials was sent to your Pipedream account's email address. The full task text is: ${config.original_body.task}`},notion:{subject:`[Notion Voice Tasks] –\xa0Notion Error`,body:()=>`Failed to create task(s) in Notion from a request via your Notion Voice Tasks workflow, sent by ${config.original_body.name} at ${config.original_body.date}.

The full text of your request is:

${config.original_body.task}

The full error message is:

${u}`,http_response:`Failed to create task(s) in Notion due to an error. An email with details of the error has been sent to your Pipedream account's email address. The full text of your task request is: ${config.original_body.task}`},config:{subject:`[Notion Voice Tasks] –\xa0Configuration Error`,body:()=>`A configuration error occured in your Notion Voice Tasks workflow. The error message is:

${u}`,http_response:`Failed to create task(s) in Notion due to a configuration error. An email with details of the error has been sent to your Pipedream account's email address. The full text of your task request is: ${config.original_body.task}`}};if("Notion"===f){let t=new e({auth:this.notion.$auth.oauth_access_token});console.log("Creating a Notion-compliant task object...");let o=this.creatNotionObject(m,0,"Error Fallback Routine"),a=[o];console.log("Sending the task to Notion...");let s=await this.createTasks(a,t),r=s[0].id;g.chatgpt.task_url=`https://notion.so/${r.replace(/-/g,"")}`}if(console.log("Sending an email to the user with error details..."),y.send.email({subject:g[f].subject,text:g[f].body()}),console.log("Sending an HTTP response to the user..."),await y.respond({status:200,headers:{},body:g[f].http_response}),!0===h)throw console.log("Ending the workflow and throwing an error..."),Error(u);console.error("Non-workflow-ending error:",u)}},async run(u){let h,f,{$:y}=u;this.send_response&&!1!==this.send_response||await this.sendResponse(y);let m=this.steps;config.original_body=m.trigger.event.body,config.pipedream=y,await this.checkBody();let g=new e({auth:this.notion.$auth.oauth_access_token});try{h=await p(e=>{try{let e=g.databases.retrieve({database_id:this.databaseID});return e}catch(t){if(400<=t.status&&t.status<=409)e(t);else throw t}},{retries:2})}catch(t){let e=Error(`Error retrieving Notion Tasks database: ${t}`);await this.sendErrorMessages(e)}try{if(h.hasOwnProperty("properties"))f=h.properties;else throw Error("Database properties not found.")}catch(t){let e=Error(`Error retrieving Notion Tasks database properties: ${t}`);await this.sendErrorMessages(e)}if(config.notion_dbs.tasks.id=this.databaseID,config.notion_dbs.tasks.properties=f,this.project){let e;try{e=await p(e=>{try{let e=g.databases.retrieve({database_id:f[this.project].relation.database_id});return e}catch(t){if(400<=t.status&&t.status<=409)e(t);else throw t}},{retries:2})}catch(t){let e=Error(`Error retrieving Notion Projects database. Attempting to create tasks without Project assignments. Error details: ${t}`);await this.sendErrorMessages(e,!1)}try{if(config.notion_dbs.projects.id=f[this.project].relation.database_id,e.hasOwnProperty("properties"))config.notion_dbs.projects.properties=e.properties;else throw Error("Project database properties not found.")}catch(t){let e=Error(`Error retrieving Notion Projects database properties. Attempting to create tasks without Project assignments. Error details: ${t}`);await this.sendErrorMessages(e,!1)}}this.setPropChoices(),console.log("Config settings:"),console.log(JSON.stringify(config,null,2));let k=await this.chatGTPHandler(m),_=await this.getClosestNotionMatch(k.final_response,g);for(let e of _)config.properties.hasOwnProperty("tasks_due_date")||delete e.due,config.properties.hasOwnProperty("tasks_assignee")||delete e.assignee;let b=this.formatChatResponse(_,k.cost,config.properties.tasks_source_value??void 0);console.log("Formatted Response:"),console.log(b),console.log("Sending tasks to Notion...");let w=await this.createTasks(b,g);return console.log("Notion response:"),console.log(w),!0===this.send_response&&await this.sendResponse(y,w.length,k.start_timestamp,k.cost),w}};