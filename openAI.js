const OpenAI = require('openai')
const axios = require('axios')
require('dotenv').config()

const ASSISTANT_ID = process.env.ASSISTANT_ID
const API_KEY = process.env.API_KEY


let openai = new OpenAI({ apiKey: API_KEY })

/**
 * Handles the whole process of getting a response from ChatGPT based on what the user asks.
 * This is the main function that ties everything together.
 */
const getChatGPTResponse = async (requestMessage) => {
    try {
        const assistant = await retrieveAssistant()
        const thread = await createThread()
        await addMessageToThread(thread.id, requestMessage)
        const run = await createAndPollRun(thread.id, assistant.id)

        if (run.status === 'completed') {
            let responseMessage = await getAssistantResponse(run.thread_id)
            responseMessage = await processResponseMessage(responseMessage)
            return responseMessage
        }

        return 'Run did not complete successfully.'
    } catch (error) {
        console.error('Error:', error)
        throw error
    }
}

/**
 * Cleans up the assistant's response by removing any unnecessary references.
 * This just makes the response look better before showing it to the user.
 */
const processResponseMessage = async (message) => {
    if (typeof message === 'string') {
        message = await removeSourceReferences(message)
    }
    return message
}

/**
 * Gets the assistant's info from OpenAI's API.
 * Needed to know which assistant you're talking to.
 */
async function retrieveAssistant() {
    try {
        const response = await axios.get(`https://api.openai.com/v1/assistants/${ASSISTANT_ID}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            }
        })

        const data = response.data
        return data
    } catch (error) {
        console.error('Error retrieving assistant:', error.response ? error.response.data : error.message)
        throw new Error('Error retrieving assistant')
    }
}

/**
 * Starts a new chat thread with the assistant.
 * Think of it as opening a new chat window.
 */
async function createThread() {
    return openai.beta.threads.create()
}

/**
 * Sends the user's message to the chat thread.
 * This is how you actually ask the assistant a question.
 */
async function addMessageToThread(threadId, messageContent) {
    await openai.beta.threads.messages.create(
        threadId,
        {
            role: 'user',
            content: messageContent
        }
    )
}

/**
 * Tells the assistant to start thinking and gets the response when it's done.
 * Basically, this is where the magic happens.
 */
async function createAndPollRun(threadId, assistantId) {
    return await openai.beta.threads.runs.createAndPoll(
        threadId,
        {
            assistant_id: assistantId
        }
    )
}

/**
 * Grabs the assistant's reply from the chat thread.
 * This is what you'll show to the user.
 */
async function getAssistantResponse(threadId) {
    const messages = await openai.beta.threads.messages.list(threadId)
    const responseMessage = messages.data.find(
        message => message.role === 'assistant'
    )
    return responseMessage.content[0].text.value
}

/**
 * Removes any source references from the response.
 * Just cleans things up a bit so it's easier to read.
 */
async function removeSourceReferences(inputString) {
    const sourceReferencePattern = /【\d+:\d+†source】/g
    return inputString.replace(sourceReferencePattern, '')
}

// Interactive Loop

/**
 * Keeps asking the user for input and shows the assistant's response.
 * Runs until the user decides to exit.
 */
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
})

const askQuestion = () => {
    readline.question('Enter your question (or X to exit): ', async (input) => {
        if (input.toUpperCase() === 'X') {
            readline.close()
        } else {
            const response = await getChatGPTResponse(input)
            console.log('Response:', response)
            askQuestion() // Keep going until the user exits
        }
    })
}

askQuestion()
