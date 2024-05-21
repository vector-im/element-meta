import { Octokit } from "@octokit/action";

const octokit = new Octokit();

const headers = { "GraphQL-Features": "projects_next_graphql" }

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const ISSUE_URL = process.env.ISSUE_URL;
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER);
const PROJECT_ID = process.env.PROJECT_ID;
const FIELD_ID = process.env.FIELD_ID;
const FIELD_NAME = process.env.FIELD_NAME;

const visitedIssueUrls = new Set();

async function queryFieldValue(repoOwner, repoName, issueNumber, fieldName) {
  const query = `query ($owner: String!, $repo: String!, $issueNumber: Int!, $fieldName: String!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        projectItems(first: 100) {
          edges {
            node {
              id
              fieldValueByName(name: $fieldName) {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  optionId
                  name
                  field {
                    ... on ProjectV2SingleSelectField {
                      id
                    }
                  }
                }
              }
              project {
                id
              }
            }
          }
        }
      }
    }
  }`;

  const parameters = {
    owner: repoOwner,
    repo: repoName,
    issueNumber: issueNumber,
    fieldName: fieldName,
    headers
  };

  const result = await octokit.graphql(query, parameters);
  
  return result.repository.issue.projectItems.edges;
}

function determineFieldValue(projectItems, projectId, fieldId) {
  for (const item of projectItems) {
    if (item.node.project.id == projectId && item.node.fieldValueByName && item.node.fieldValueByName.field.id == fieldId) {
      return { name: item.node.fieldValueByName.name, id: item.node.fieldValueByName.optionId };
    }
  }

  return {}
}

async function setFieldValueOnTrackedIssues(repoOwner, repoName, issueUrl, issueNumber, projectId, fieldId, fieldName, fieldValue) {
  // Avoid infinite loop

  if (visitedIssueUrls.has(issueUrl)) {
    return;
  }
  visitedIssueUrls.add(issueUrl);
  
  // Make sure this is actually an issue
  
  if (issueUrl.indexOf("/issues/") < 0) {
    return;
  }

  // Get tracked issues

  console.log(`Querying tracked issues of ${issueUrl}`);
  const trackedIssues = await queryTrackedIssues(repoOwner, repoName, issueNumber);

  if (!trackedIssues || trackedIssues.length == 0) {
    console.log("Aborting because issue has no tracked issues");
    return;
  }
  
  console.log(trackedIssues.map(issue => issue.node.url));
  
  // Set field values

  for (const issue of trackedIssues) {
    const trackedIssueId = issue.node.id;
    const trackedIssueUrl = issue.node.url;
    const trackedIssueNumber = issue.node.number;
    const trackedRepoOwner = issue.node.repository.owner.login;
    const trackedRepoName = issue.node.repository.name;
    
    // Get project item or add one if needed

    let itemId = issue.node.projectItems.edges.find(item => item.node.project.id == projectId)?.node?.id;
    
    if (!itemId) {
      console.log(`Adding ${trackedIssueUrl} to project`);
      itemId = await addItemToProject(projectId, trackedIssueId);
    }

    // Set field value

    console.log(`Setting value "${fieldValue.name}" for field "${fieldName}" of ${trackedIssueUrl}`);
    mutateFieldValue(projectId, itemId, fieldId, fieldValue.id);

    // Recurse

    await setFieldValueOnTrackedIssues(trackedRepoOwner, trackedRepoName, trackedIssueUrl, trackedIssueNumber, projectId, fieldId, fieldName, fieldValue);
  }
}

async function queryTrackedIssues(repoOwner, repoName, issueNumber) {
  const query = `query ($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        trackedIssues(first: 100) {
          edges {
            node {
              projectItems(first: 100) {
                edges {
                  node {
                    id
                    project {
                      id
                    }
                  }
                }
              }
              id
              url
              number
              repository {
                name
                owner {
                  login
                }
              }
            }
          }
        }
      }
    }
  }`;

  const parameters = {
    owner: repoOwner,
    repo: repoName,
    issueNumber: issueNumber,
    headers
  };

  const result = await octokit.graphql(query, parameters);

  return result.repository.issue.trackedIssues.edges;
}

async function addItemToProject(projectId, contentId) {
  const mutation = `mutation ($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {projectId: $projectId contentId: $contentId}) {
      item {
        id
      }
    }
  }`;

  const parameters = {
    projectId: projectId,
    contentId: contentId,
    headers
  };

  const result = await octokit.graphql(mutation, parameters);

  return result.addProjectV2ItemById.item.id;
}

async function mutateFieldValue(projectId, itemId, fieldId, fieldValueId) {
  const mutation = `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: { 
          singleSelectOptionId: $optionId        
        }
      }
    ) {
      projectV2Item {
        id
      }
    }
  }`;

  const parameters = {
    projectId: projectId,
    itemId: itemId,
    fieldId: fieldId,
    optionId: fieldValueId,
    headers
  };

  await octokit.graphql(mutation, parameters);
}

(async function main() {
  // Get project items

  console.log(`Querying value for field "${FIELD_NAME}" of ${ISSUE_URL}`);
  const projectItems = await queryFieldValue(REPO_OWNER, REPO_NAME, ISSUE_NUMBER, FIELD_NAME);

  if (!projectItems) {
    console.log("Aborting because issue is not part of any projects");
    return;
  }

  // Determine field value

  fieldValue = determineFieldValue(projectItems, PROJECT_ID, FIELD_ID);

  if (!fieldValue.name || !fieldValue.id) {
    console.log("Aborting because issue is not part of the correct project");
    return;
  }
  
  console.log(`Determined field value "${fieldValue.name}" (${fieldValue.id})`);

  // Set field value on tracked issues

  await setFieldValueOnTrackedIssues(REPO_OWNER, REPO_NAME, ISSUE_URL, ISSUE_NUMBER, PROJECT_ID, FIELD_ID, FIELD_NAME, fieldValue);
  
})();
