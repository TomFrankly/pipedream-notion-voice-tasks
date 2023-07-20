## Overview

This workflow lets you create new tasks in Notion **using your voice**. It also includes some advanced features:

* You can create multiple tasks in a single voice prompt
* Relative due dates are supported (e.g. "by *next Friday*")
* You can mention assignees and projects, which the workflow will attempt to intelligently match to existing Notion users and projects

**Need help with this workflow? [Check out the full instructions and FAQ here.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/)**

## Compatibility

This workflow will work with any Notion database.

### Looking for a template to use?

For general productivity use, you'll love [Ultimate Brain](https://thomasjfrank.com/brain/) – my all-in-one second brain template for Notion. 

Ultimate Brain brings tasks, notes, projects, and goals all into one tool. Naturally, it works very well with this workflow.

**Are you a creator?** My [Creator's Companion](https://thomasjfrank.com/creators-companion/) template includes a ton of features that will help you make better-performing content and optimize your production process. There's even a version that includes Ultimate Brain, so you can easily use this workflow to create tasks related to your content.

## Instructions

Below you'll find brief instructions. [Click here for the full instructions](https://thomasjfrank.com/notion-chatgpt-voice-tasks/), which include screenshots and a video tutorial.

### Trigger Step

* In the **trigger** step above, hit **Save and Continue**, leaving the default settings in place.
* Copy your unique URL from the **Select Event** section. You'll need to add this to your **mobile app workflow**, as it is the URL your app will send requests to.
* Send a test request via your mobile app (instructions below).
* Select the test event when it appears. Then click **Continue**.

### Mobile App Setup

You can create voice tasks with this workflow on iOS, MacOS, and Android.

* For MacOS and iOS (iPhone, iPad), we'll use the **Shortcuts** app. [Click here to access my shared workflow and instructions.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#ios)
* For Android, we'll use the **Tasker** app ($3.49 USD, one-time). [Click here to access my shared workflow and instructions.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#android) *At this time, I know of no free app for Android that can handle this workflow.*

Once you've set up the workflow on your phone, run it once to send a Test Event to this Pipedream workflow.

*Technically, you can also create tasks via any tool that will let you make an HTTP request with a JSON body. [See the full blog post for instructions on this.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#http-generic)*

### This Step

* Enter your OpenAI API key. If you don't have one, [create one here.](https://platform.openai.com/account/api-keys) If you don't have an OpenAI account, create one first and enter billing details (this workflow is extremely cheap to run – see the FAQ section below for cost info).
* Follow the instructions in the other required properties. More properties may pop in dynamically based on what you choose.
* Note the *Optional Fields* below. These aren't required, but you can use them to add more detail to your tasks, switch ChatGPT models, etc.
* **Test** your workflow to make sure it works.
* Hit **Deploy** to make your workflow live.

## FAQs

### Cost

Using the ChatGPT API to parse tasks costs a small amount of money per run. Beyond that, this workflow is free to use and does not require a paid Pipedream plan.

When using the default **gpt-3.5-turbo** model, this workflow typically costs around $0.003 per run. When using **gpt-4**, the average cost increases by about 7.5x, up to $0.022 per run.

Including multiple tasks in a single voice prompt (i.e. single run) will not increase the cost very much. This is because costs are based on how many tokens are in each request to OpenAI, and the system messages in this workflow that instruct ChatGPT on how to process your input take up **far** more tokens than your input likely will.

[More details are available in the full blog post.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#cost)

### Privacy

The request body from your mobile shortcut – shown in `steps.trigger.event.body` above – is sent to OpenAI so ChatGPT can parse it. This is what powers the workflow. No other data is sent to OpenAI. [More details are available in the full blog post.](https://thomasjfrank.com/notion-chatgpt-voice-tasks/#privacy)

### Code

The code that runs this workflow has been compressed for performance reasons. If you want, you can [view my uncompressed code on Github.](https://github.com/TomFrankly/pipedream-notion-voice-tasks/blob/main/Notion-Voice-Tasks.js)

## More Resources

**More automations you may find useful:**

* [Send Voice Note Transcriptions and Summaries to Notion](https://thomasjfrank.com/how-to-transcribe-audio-to-text-with-chatgpt-and-notion/)
* [Notion to Google Calendar Sync](https://thomasjfrank.com/notion-google-calendar-sync/)

**All My Notion Automations:**

* [Notion Automations Hub](https://thomasjfrank.com/notion-automations/)

**Want to get notified about updates to this workflow (and about new Notion templates, automations, and tutorials)?**

* [Join my Notion Tips newsletter](https://thomasjfrank.com/fundamentals/#get-the-newsletter)
