/*
Copyright 2023 New Vector Ltd.

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

import fs from "fs";
import { Command } from "commander";
import githubLabelSync, { LabelDiff, LabelInfo } from "github-label-sync";
import octonode from "octonode";
import YAML from "yaml";

main();

async function main() {
  const accessToken = process.env.GITHUB_TOKEN!;
  const repo = process.env.GITHUB_REPOSITORY!;
  console.log(`Repository: ${repo}`);

  const cmd = new Command("sync-labels.ts")
    .option("--delete", "Removes labels that exist in the repository but are missing from all sources", false)
    .option("--dir <path>", "Working directory to run in")
    .option("--labels <path...>", "Label source as GitHub repository slug or path to local YAML file. Can be specified multiple times.")
    .option("--wet", "Write changes, *don't* run in dry mode", false)
    .parse();
  const opts = cmd.opts();
  console.log(`Options: ${JSON.stringify(opts)}`);

  if (opts.dir) {
    process.chdir(opts.dir);
  }
  
  try {
      const merged = await readAndMergeLabels(opts.labels, accessToken);
      await syncLabels(merged, repo, accessToken, opts.delete, opts.wet);
  } catch (e) {
      console.error("Error syncing labels", e);
      process.exit(1);
  }
}

async function readAndMergeLabels(srcs: string[], accessToken: string): Promise<Map<string, LabelInfo>> {
  const merged = new Map<string, LabelInfo>();

  for (const src of srcs) {
    console.log();
    console.log(`Loading labels from ${src}`);
    const labels = fs.existsSync(src) ? readLabelsFromFile(src) : await readLabelsFromRepo(src, accessToken);
    if (!labels) {
      continue;
    }

    for (const label of labels) {
      if (!label.name) {
        console.warn(`Ignoring invalid label without a name: ${label}`);
        continue;
      }
      if (merged.has(label.name)) {
        console.log(`Overriding label ${label.name}`);
      } else {
        console.log(`Adding label ${label.name}`);
      }
      merged.set(label.name, label);
    }
  }

  return merged;
}

function readLabelsFromFile(file: string): LabelInfo[] {
  const content = fs.readFileSync(file, "utf-8");
  return YAML.parse(content) as LabelInfo[];
}

async function readLabelsFromRepo(slug: string, accessToken: string): Promise<LabelInfo[]> {
  const client = octonode.client(accessToken);

  const labels: LabelInfo[] = [];
  const params = { page: 1, per_page: 100 };

  while (true) {
    const [status, chunk] = await client.getAsync(`/repos/${slug}/labels`, params);
    if (status !== 200) {
      throw `Fetching labels failed: ${status}`;
    }

    for (const item of chunk) {
      labels.push({
        name: item.name,
        description: item.description ?? "",
        color: item.color,
      })
    }

    if (chunk.length !== params.per_page) {
      break;
    }
    
    params.page += 1;
  }

  return labels;
}

async function syncLabels(labels: Map<string, LabelInfo>, repo: string, accessToken: string, deleteAddedLabels: boolean, writeChanges: boolean) {
  console.log();
  console.log("Syncing labels");

  const diffs = await githubLabelSync({
    accessToken,
    repo,
    labels: [...labels.values()],
    dryRun: !writeChanges,
    allowAddedLabels: !deleteAddedLabels
  });

  if (!diffs.length) {
    console.log(`Label sync completed without changes`);
    return;
  }

  logDiffs(diffs, repo);
}

function logDiffs(diffs: LabelDiff[], repo: string) {
  const missing = diffs.filter(d => d.type == "missing");
  if (missing.length > 0) {
    console.log();
    console.log(`The following labels are missing in ${repo} but exist in one of the sources. They will be created.`)
    for (const diff of missing) {
      console.log(`- name: "${diff.expected?.name}"`);
    }
  }

  const changed = diffs.filter(d => d.type == "changed");
  if (changed.length > 0) {
    console.log()
    console.log(`The following labels exist in ${repo} but differ in one of the sources. They will be modified.`)
    for (const diff of changed) {
      console.log(`- name: "${diff.actual?.name}"`);
      if (diff.expected?.description != diff.actual?.description) {
        console.log(`  description (actual):   ${diff.actual?.description}`);
        console.log(`  description (expected): ${diff.expected?.description}`);
      }
      if (diff.expected?.color != diff.actual?.color) {
        console.log(`  color (actual):   ${diff.actual?.color}`);
        console.log(`  color (expected): ${diff.expected?.color}`);
      }
    }
  }

  const added = diffs.filter(d => d.type == "added");
  if (added.length > 0) {
    console.log();
    console.log(`The following labels exist in ${repo} but are missing in all sources. They will be deleted.`)
    for (const diff of added) {
      console.log(`- name: "${diff.actual?.name}"`);
      if (diff.actual?.description) {
        console.log(`  description: "${diff.actual?.description}"`);
      }
      if (diff.actual?.color.length) {
        console.log(`  color: "${diff.actual?.color}"`);
      }
    }
  }
}
