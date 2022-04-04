// github-action.js - Reference Example
// Meant to be run as a workflow within GitHub Actions to run batch scanning/enforcement
//  of configuration settings for multiple repositories within an organization.
//
// Environment Variables:
// GHWATCHER_CHECK_ORG: String, required, name of the GitHub Organization to scan.
// GHWATCHER_CHECK_REPO: String, optional, name of repository to check.  If empty, all discovered repositories will be checked.
// GHWATCHER_ALLOWED_ORG_LIST: String (comma or space delimited), required, to determine if the `GHWATCHER_CHECK_ORG` value is matched to a valid listing of
//   Organization names which this application is allowed to target.  Limits interactions from this application to only scan
//   specified target Organizations which are explicitly allowed. Supports a String value either space or comma delimited.
// GHWATCHER_CHECK_BRANCH: String, optional, name of branch to check.  If empty, discovered default_branch will be checked.
// GHWATCHER_ENABLE_DEPENDABOT: String, optional, Used to determine if Dependabot scanning should be enabled on repositories when
//   applying branch protection rules, enabling by setting a String value of `true`. Default value is `null`.

const watcher = require('./watcher');

if (process.env.GHWATCHER_ALLOWED_ORG_LIST === (null || undefined)) {
  throw new Error('Could not determine ALLOWED_ORG_LIST. Environment variable GHWATCHER_ALLOWED_ORG_LIST must be set for valid target organization name(s).');
};

if (
  process.env.GHWATCHER_CHECK_ORG &&
  (process.env.GHWATCHER_ALLOWED_ORG_LIST).match(RegExp('(^|\\s*|,)' + process.env.GHWATCHER_CHECK_ORG + '($|\\s*|,)'))) {
  watcher.getProtectionStatus(process.env.GHWATCHER_CHECK_ORG, process.env.GHWATCHER_CHECK_REPO, process.env.GHWATCHER_CHECK_BRANCH).then(
    async(response) => {
      for await (const repo of response.repos) {
        if (repo.branches.length === 0) {
          await watcher.createDefaultBranch(response.organization, repo.name).then(repo.branches.push({name: 'main'}));
        }
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
        }
      };
    }).then(
    async() => {
      const final_response = await watcher.getProtectionStatus(process.env.GHWATCHER_CHECK_ORG, process.env.GHWATCHER_CHECK_REPO, process.env.GHWATCHER_CHECK_BRANCH);
      console.log(JSON.stringify(final_response, null, 2));
      return final_response;
    },
  );


} else {
  throw new Error('Could not determine ORG to check -- ENV variable GHWATCHER_CHECK_ORG not set.');
};
