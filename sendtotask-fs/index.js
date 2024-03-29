const { CloudTasksClient } = require('@google-cloud/tasks');
const { PubSub } = require('@google-cloud/pubsub');
const { Firestore } = require('@google-cloud/firestore');

const VALIDATOR_URL = process.env.VALIDATOR_URL;
const PROJECT = process.env.PROJECT_ID;
const GCP_SA_EMAIL = process.env.GCP_SA_EMAIL;

const LOCATION = 'us-east4';
const QUEUE = 'validation-queue';
const CHECK_INTERVAL = 20 * 60; // 20 minutes

const FIRESTORE_LOG_TOPIC = 'firestore-log';
const FIRESTORE_COLLECTION = 'bucket-status';
const PENDING_TASK_STATUS = 'PENDING';

// lazy globals
let bucketName;

// cloud clients
let cloudTaskClient;
let pubSubClient;

/**
 * Sends tasks to tasker
 *
 * @param {!Object} event The Cloud Functions event.
 */
exports.sendToTask = async (event) => {
  try {
    const message = event.value.fields;

    console.log(`Message: ${JSON.stringify(message)}`);

    // extract trigger message data
    const lastUpdateTime = message.lastUpdateTime.stringValue;
    const lastUpdateFile = message.lastUpdateFile.stringValue;
    const lastUpdateEvent = message.lastUpdateEvent.stringValue;
    const email = message.email.stringValue;
    bucketName = message.bucketName.stringValue;

    // create client and construct queue name
    cloudTaskClient = new CloudTasksClient();
    const parent = cloudTaskClient.queuePath(PROJECT, LOCATION, QUEUE);

    // create httpRequest task
    const validatorTask = {
      httpRequest: {
        httpMethod: 'POST',
        url: VALIDATOR_URL,
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        oidcToken: {
          serviceAccountEmail: GCP_SA_EMAIL,
        },
      },
      scheduleTime: {
        seconds: CHECK_INTERVAL + Date.now() / 1000,
      },
    };

    // create and add body
    const payload = {
      lastUpdateTime: lastUpdateTime,
      lastUpdateFile: lastUpdateFile,
      lastUpdateEvent: lastUpdateEvent,
      email: email,
      bucketName: bucketName,
    };
    validatorTask.httpRequest.body = new Uint8Array(
      JSON.stringify(payload)
        .split('')
        .map((char) => char.charCodeAt(0))
    );

    // https://googleapis.dev/nodejs/tasks/latest/google.cloud.tasks.v2beta2.CloudTasks.html
    // avoid duplicate tasks
    await deleteExistingTask(bucketName);

    // create and send task
    console.log(`Sending task: ${JSON.stringify(validatorTask)}`);
    const createTaskRequest = { parent, task: validatorTask, view: 'FULL' };
    const [createTaskResponse] = await cloudTaskClient.createTask(createTaskRequest);
    const newTaskName = createTaskResponse.name;
    console.log(`Created Task ${JSON.stringify(newTaskName)}`);

    // add taskName to firestore
    await logTaskName(newTaskName);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return;
  }

  console.log(`Successful run!`);
};

/**
 * Checks if another task exists for the same bucket
 * If so, delete that task
 *
 * @param {!Object} bucketName The name of the bucket
 */
const deleteExistingTask = async (bucketName) => {
  try {
    // create client and get bucket data
    const firestore = new Firestore();
    const collection = firestore.collection(FIRESTORE_COLLECTION);
    const documentRef = await collection.doc(bucketName).get();
    const data = documentRef.data();

    // extract data from firestore doc
    const taskStatus = data.taskStatus;
    const existingTaskName = data.taskName;

    // prints out data of bucket
    console.log(`deleteExistingTask DATA: ${JSON.stringify(data)}`);
    console.log(
      `${bucketName} has ${taskStatus} tasks${existingTaskName ? ` : ${existingTaskName}` : `!`}`
    );

    // removes task in queue
    if (existingTaskName && taskStatus == PENDING_TASK_STATUS) {
      const deleteTaskRequest = {
        name: existingTaskName,
      };

      await cloudTaskClient.deleteTask(deleteTaskRequest);
      console.log(`${existingTaskName} was deleted!`);
    }
  } catch (err) {
    console.error(`deleteExistingTask Error: ${err.message}`);
    console.error(`No task was deleted..`);
  }
};

/**
 * Sends new newTaskName to Firestore collection: bucket-status
 *
 * @param {string} newTaskName The name of the new task
 */
const logTaskName = async (newTaskName) => {
  try {
    // serialize data for PubSub
    const pubSubData = JSON.stringify({
      collectionName: FIRESTORE_COLLECTION,
      bucketName: bucketName,
      taskName: newTaskName,
      taskStatus: PENDING_TASK_STATUS,
    });
    const dataBuffer = Buffer.from(pubSubData);

    // update firestore entry with event data
    pubSubClient = new PubSub();
    const firestoreLogMessageId = await pubSubClient.topic(FIRESTORE_LOG_TOPIC).publish(dataBuffer);
    console.log(`MessageID: ${firestoreLogMessageId} published!`);
  } catch (err) {
    console.error(`logTaskName Error: ${err.message}`);
  }
};
