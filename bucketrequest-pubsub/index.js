const { Storage } = require('@google-cloud/storage');

/**
 * Creates Google Storage Bucket
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.bucketRequest = async (req, res) => {
  const LOCATION = 'US-EAST4';
  const STORAGE_CLASS = 'STANDARD';
  const TOPIC = 'bucket-changed';

  const bucketName = req.body.bucketName;

  const storage = new Storage();

  // creates bucket
  await storage.createBucket(bucketName, {
    location: LOCATION,
    storageClass: STORAGE_CLASS,
  });
  console.log(`Bucket ${bucketName} created!`);

  // creates notification for bucket
  await storage.bucket(bucketName).createNotification(TOPIC);
  console.log(`Bucket ${bucketName} registered for ${TOPIC} topic!`);

  res.status(200).send(`${bucketName} created and setup`);
};