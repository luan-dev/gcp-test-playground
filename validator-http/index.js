const { Firestore } = require('@google-cloud/firestore');

/**
 * Validates files based on Firestore log
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.validator = async (req, res) => {
  const message = req.body;

  console.log(`Request: ${message}`);

  const bucketName = message.bucketName || 'bucket';

  console.log(`Bucket: ${bucketName}`);

  const firestore = new Firestore();
  const collection = firestore.collection('bucket');

  try {
    const document = await collection.doc(bucketName);

    console.log(`${bucketName} submissionTime: ${document.submissionTime}`);
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }

  res.status(200).send(`Completed!`);
};