const { Storage } = require('@google-cloud/storage');

/**
 * Moves files between storage buckets
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */
exports.transferFiles = async (req, res) => {
  const storage = new Storage();

  const srcBucket = req.body.srcBucket || 'gcp-bucket-deposit';
  const destBucket = req.body.destBucket || 'gcp-bucket-destination';
  const deleteSrc = req.body.deleteSrc || false;

  const [srcFiles] = await storage.bucket(srcBucket).getFiles();

  console.log(`srcFiles: ${srcFiles}`);

  srcFiles.forEach(async (file) => {
    console.log(`Processing ${file.name}...`);

    const existsData = await storage.bucket(destBucket).file(file.name).exists();
    console.log(existsData[0]);

    if (existsData[0]) {
      console.log(`${file.name} already exists!`);

      // archive old file
      const [metadata] = await storage.bucket(destBucket).file(file.name).getMetadata();
      const archivedName = `${file.name}-${timeCreated}`;
      console.log(`Renaming ${file.name} to ${archivedName}`);
      await storage.bucket(destBucket).file(file.name).rename(archivedName);

      const contentType = metadata.contentType;
      console.log(`${file.name} is a ${contentType}`);
      if (metadata.contentType == 'Folder') {
        console.log(`tis a folder`);
      }
    }

    // copy over file
    await storage
      .bucket(srcBucket)
      .file(file.name)
      .copy(storage.bucket(destBucket).file(file.name));

    console.log(`${file.name} copied!`);

    if (deleteSrc) {
      await storage.bucket(srcBucket).file(file.name).delete();
      console.log(`${file} deleted!`);
    }
  });

  res.status(200).send(`${srcFiles.length} file(s) moved from ${srcBucket} to ${destBucket}`);
};
