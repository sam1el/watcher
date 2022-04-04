// github-action.js - Reference Example
// Meant to be run as a workflow within GitHub Actions to run batch scanning/enforcement
//  of configuration settings for multiple repositories within an organization.
//
// Environment Variables:
// GHWATCHER_CHECK_ORG: String, required, name of the GitHub Organization to scan.
// GHWATCHER_CHECK_REPO: String, optional, name of repository to check.  If empty, all discovered repositories will be checked.
// GHWATCHER_CHECK_BRANCH: String, optional, name of branch to check.  If empty, discovered default_branch will be checked.

const watcher = require('./watcher');

if (process.env.GHWATCHER_CHECK_ORG) {
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

          if (repo.dependabot_vulnerability_alerts_enabled !== true) {
            await watcher.enableVulnerabilityAlert(response.organization, repo.name);
          }
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
