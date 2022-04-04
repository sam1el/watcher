// index.js - Reference Example
// Meant to be run as a standalone web app to listen for events from a GitHub organization webhook to
//  trigger creation of a default branch, if missing, and setup branch protection rules.

const watcher = require('./watcher');
const express = require('express');
// const crypto = require('crypto');
const app = express();
const WEB_PORT = (process.env.GHWATCHER_PORT || process.env.PORT);
// const WEB_APP_SECRET = (process.env.GHWATCHER_WEB_APP_SECRET);
const ALLOWED_ORG_LIST = (process.env.GHWATCHER_ALLOWED_ORG_LIST);

if (WEB_PORT === (null || undefined)) {
  throw new Error('Could not determine WEB_PORT. Environment variables GHWATCHER_PORT or PORT must be set.');
};

if (ALLOWED_ORG_LIST === (null || undefined)) {
  throw new Error('Could not determine ALLOWED_ORG_LIST. Environment variable GHWATCHER_ALLOWED_ORG_LIST must be set for valid target organization name(s).');
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => {
  res.send('Successful response.');
});

app.post('/github-watcher', async(req, res) => {
  // Validate the signature against secret, if present in request
  // Reference https://gist.github.com/stigok/57d075c1cf2a609cb758898c0b202428
  //
  // TODO: This is not quite working yet
  //
  // console.log(req.headers)
  // if (req.headers['X-Hub-Signature-256']) {
  //   const sig = Buffer.from(req.headers['X-Hub-Signature-256'] || '', 'utf8');
  //   const hmac = crypto.createHmac('sha256', WEB_APP_SECRET);
  //   const digest = Buffer.from('sha256' + '=' + hmac.update(req.rawBody).digest('hex'), 'utf8');
  //   if (sig.length !== digest.length || !crypto.timingSafeEqual(digest, sig)) {
  //     console.log(`Request body digest (${digest}) did not match ${'X-Hub-Signature-256'} (${sig})`);
  //   } else {
  //     console.log('Signature match ok!');
  //   }
  // }

  if (req.body.action === 'created' &&
  (ALLOWED_ORG_LIST).match(RegExp('(^|\\s*|,)' + req.body.repository.owner.login + '($|\\s*|,)'))) {
    watcher.getProtectionStatus(
      req.body.repository.owner.login,
      req.body.repository.name,
    ).then(
      async(response) => {
        for await (const repo of response.repos) {
          if (repo.branches.length === 0) {
            await watcher.createDefaultBranch(response.organization, repo.name).then(repo.branches.push({name: 'main'}));
          };

          for (const branch of repo.branches){
            if (branch.protected !== true) {
              await watcher.setBranchProtection(response.organization, repo.name, branch.name);
            };

            if (
              (process.env.GHWATCHER_ENABLE_DEPENDABOT &&
                process.env.GHWATCHER_ENABLE_DEPENDABOT.match(/true/)) &&
              repo.dependabot_vulnerability_alerts_enabled !== true) {
              await watcher.enableVulnerabilityAlert(response.organization, repo.name);
            };
          };

          await watcher.createNotificationIssue(
            req.body.repository.owner.login,
            req.body.repository.name,
            req.body.sender.login,
          );
        };
      }).then(
      async() => {
        const final_response = await watcher.getProtectionStatus(
          req.body.repository.owner.login,
          req.body.repository.name,
        );
        res.send(final_response);
      },
    );
  } else {
    res.send('No action taken');
  }
});

app.listen(WEB_PORT, () => console.log('watcher app is listening on http://localhost:%s', WEB_PORT));
