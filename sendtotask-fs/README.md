# Send To Cloud Tasks

> Sends validation requests into a queue and waits 15 minutes until

<p align="center">
  <a href="https://github.com/luan-asym/gcp-test-playground/actions/workflows/deploy-sendtotask.fs.yml">
    <img src="https://github.com/luan-asym/gcp-test-playground/actions/workflows/deploy-sendtotask.fs.yml/badge.svg">
  </a>
</p>

## Additional Notes

- Requires a queue named `validation-queue` in Cloud Tasks
- PubSub message **MUST** contain the param `bucketName`
