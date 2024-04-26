/*
Copyright 2024 New Vector Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/


// For running in an action
const { Octokit } = require("@octokit/action");
const octokit = new Octokit();

// For running locally
// const { Octokit } = require("@octokit/core");
// const octokit = new Octokit({ auth: process.env.GH_TOKEN });


// List all the defects with their GH project "Score" field
async function listDefects(repoOwner, repoName, projectFieldName = "Score", label = "T-Defect") {
    const query = `
    query ($repoOwner: String!, $repoName: String!, $label: String!, $projectFieldName: String!, $after: String) {
            repository(owner: $repoOwner, name: $repoName) {
                issues(labels: [$label], states: OPEN, first: 10, after: $after) {
                    nodes {
                        number
                        title
                        labels(first: 10) {
                            nodes {
                                name
                            }
                        }
                        projectItems(first: 10) {
                            nodes {
                                id
                                project {
                                    id
                                }
                                score: fieldValueByName(name: $projectFieldName) {
                                    ... on ProjectV2ItemFieldNumberValue {
                                        id
                                        number
                                    }
                                }
                            }
                        }
                    }
                    pageInfo {
                        endCursor
                        hasNextPage
                      }
                }
            }
        }
    `;

    var issues = [];
    var hasNextPage = true;
    var after = null;

    while (hasNextPage) {
        const parameters = {
            repoOwner,
            repoName,
            label,
            projectFieldName,
            after
        };

        const result = await octokit.graphql(query, parameters);
        issues = issues.concat(result.repository.issues.nodes);
        hasNextPage = result.repository.issues.pageInfo.hasNextPage;
        after = result.repository.issues.pageInfo.endCursor;
    }

    return issues;
}


// Extract the score from the GraphQL response.
// scoreItem is { id, project { id }, score: { id, number }}
function getScoreItem(issue, projectId) {
    var scoreItem = 0;
    issue.projectItems.nodes.forEach(item => {
        if (item.project.id === projectId) {
            scoreItem = item;
        }
    });

    if (scoreItem == null) {
        console.log("No score found for issue " + issue.number);
    }

    return scoreItem;
}

// Compute the score of a defect based on the labels as per:
// https://github.com/element-hq/element-meta/wiki/triage-process#prioritisation
function computeIssueScore(issue) {
    var severity = 0;
    var occurence = 0;
    issue.labels.nodes.forEach(label => {
        switch (String(label.name)) {
            case "O-Uncommon":
                occurence = 1;
                break;
            case "O-Occasional":
                occurence = 2;
                break;
            case "O-Frequent":
                occurence = 3;
                break;
            case "S-Tolerable":
                severity = 1;
                break;
            case "S-Minor":
                severity = 2;
                break;
            case "S-Major":
                severity = 3;
                break;
            case "S-Critical":
                severity = 4;
                break;
            default:
                break;
        }
    });

    return severity * occurence;
}

// Update a score in the GH project
async function setNewScore(scoreItem, projectFieldId, fieldValue) {
    const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $projectFieldId: ID!, $value: Float!) {
      updateProjectV2ItemFieldValue(
        input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $projectFieldId
          value: { 
            number: $value        
          }
        }
      ) {
        projectV2Item {
          id
        }
      }
    }
    `;

    const parameters = {
        projectId: scoreItem.project.id,
        itemId: scoreItem.id,
        projectFieldId: projectFieldId,
        value: fieldValue
    };

    await octokit.graphql(mutation, parameters);
}


(async function main() {
    const repoOwner = process.env.REPO_OWNER;
    const repoName = process.env.REPO_NAME;
    const projectId = process.env.PROJECT_ID;
    const projectFieldId = process.env.PROJECT_FIELD_ID;
    const projectFieldName = process.env.PROJECT_FIELD_NAME;

    const issues = await listDefects(repoOwner, repoName, projectFieldName);
    console.log("Found " + issues.length + " T-Defect issues");

    issues.filter(issue => {
        // Check if it is part of the GH project
        const ok = issue.projectItems.nodes.some(item => { return item.project.id === projectId; });
        if (!ok) {
            console.log("Issue " + issue.number + " is not part of the project");
        }
        return ok;
    })
        .filter(issue => {
            // Check if it has the triaging labels, ie a label that starts with "S-" and a label that starts with "O-"
            const ok = issue.labels.nodes.some(label => { return label.name.startsWith("S-"); }) && issue.labels.nodes.some(label => { return label.name.startsWith("O-"); });
            if (!ok) {
                console.log("Issue " + issue.number + " is not labeled correctly. Labels: " + issue.labels.nodes.map(label => label.name));
            }
            return ok;
        })
        .forEach(issue => {
            const scoreItem = getScoreItem(issue, projectId);

            // Ignore issues with a score manually set higher than 100. This is a way to fine control the priority of issues
            if (scoreItem.score && scoreItem.score.number >= 100) {
                return;
            }

            // Update the score if it is different
            var computedScore = computeIssueScore(issue);
            if (scoreItem.score == null || scoreItem.score.number != computedScore) {
                console.log(issue.number + " - " + " Updating score from " + (scoreItem.score ? scoreItem.score.number : "null") + " to " + computedScore + " - " + issue.title);

                setNewScore(scoreItem, projectFieldId, computedScore).catch(error => {
                    console.error("Error updating score for issue " + issue.number + ": " + error);
                });
            }
        });

})();



// The query to use in https://docs.github.com/en/graphql/overview/explorer to find ids for the GH project id and the Score field
/*
query($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      issues(labels: ["T-Defect"], states: OPEN, first:3) {
        nodes {
          title
          projectItems(first: 2) {
            nodes {
              project {
                id
                score: field(name: "Score") {
                  ... on ProjectV2Field {
                    id
                  }
                }		
              }
            }
          }
        }
      }
    }
  }

  Variables
  {"owner": "element-hq","repo": "element-x-ios"}
  */
 