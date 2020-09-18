const core = require('@actions/core');
//const github = require('@actions/github');

const fs = require('fs');

const pipelineInputFileName = core.getInput('pipeline-results-json'); // 'results.json'
const sarifOutputFileName = core.getInput('output-results-sarif'); // 'coverity-results.sarif'
