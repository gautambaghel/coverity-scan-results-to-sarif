const core = require('@actions/core');
//const github = require('@actions/github');

const fs = require('fs');

const pipelineInputFileName = core.getInput('pipeline-results-json'); // 'coverity-results.json'
const sarifOutputFileName = core.getInput('output-results-sarif'); // 'coverity-results.sarif'

// none,note,warning,error
const impactToLevel = (impact => {
    switch (impact) {
        case "High":
          return "error";
        case "Medium":
          return "warning";
        case "Low":
          return "note";
        default:
          return "none";
    }
})

const addRuleToRules = (issue,rules) => {
    if (rules.filter(ruleItem => ruleItem.id===issue.checkerProperties.cweCategory).length>0) {
        return null;
    }
    /*
     {
              "id": "no-unused-vars",
              "shortDescription": {
                "text": "disallow unused variables"
              },
              "helpUri": "https://eslint.org/docs/rules/no-unused-vars",
              "properties": {
                "category": "Variables"
              }
            }
    */
    let rule = {
        id: issue.checkerProperties.cweCategory,
        shortDescription: {
            text: "CWE-"+issue.checkerProperties.cweCategory+": "+issue.checkerProperties.subcategoryShortDescription
        },
        helpUri: "https://cwe.mitre.org/data/definitions/"+issue.checkerProperties.cweCategory+".html",
        help: {
            text: "CWE-"+issue.checkerProperties.cweCategory+": "+issue.checkerProperties.subcategoryLongDescription
          },
        properties: {
            category: issue.checkerProperties.category
        },
        defaultConfiguration: {
            level: impactToLevel(issue.checkerProperties.impact)
        }
    }

    return rule;
}

const convertPipelineResultFileToSarifFile = (inputFileName,outputFileName) => {
    var results = {};

    let rawdata = fs.readFileSync(inputFileName);
    results = JSON.parse(rawdata);
    console.log('Pipeline Scan results file found and parsed - validated JSON file');

    let issues = results.issues;
    console.log('Issues count: '+issues.length);

    let rules=[];

    // convert to SARIF json
    let sarifResults = issues.map(issue => {
        // append rule to ruleset - if not already there
        let rule = addRuleToRules(issue,rules);
        if (rule!==null){
            rules.push(rule);
        }

        let location = {}
        let eventDescription = ""
        issue.events.map(event => {
            if (event.main==true) {
                location = {
                    physicalLocation: {
                        artifactLocation: {
                            uri: event.strippedFilePathname
                        },
                        region: {
                            startLine: parseInt(event.lineNumber)
                        }
                    }
                }
                eventDescription = eventDescription.concat(event.eventDescription)
            }
            else if (event.eventTag == "remediation") {
                eventDescription = eventDescription.concat(event.eventDescription)
            }
        })

        // get the severity according to SARIF
        let sarImp = impactToLevel(issue.checkerProperties.impact);
        // populate issue
        let resultItem = {
            level: sarImp,
            message: {
                text: eventDescription,
            },
            locations: [location],
            ruleId: issue.checkerProperties.cweCategory
        }
        return resultItem;
    })

    // construct the full SARIF content
    let sarifFileJSONContent = {
        $schema : "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        version : "2.1.0",
        runs : [
            {
                tool : {
                    driver : {
                        name : "Coverity Static Analysis Results",
                        rules: rules
                    }
                },
                results: sarifResults
            }   
        ]
    };

    // save to file
    fs.writeFileSync(outputFileName,JSON.stringify(sarifFileJSONContent, null, 2));
    console.log('SARIF file created: '+outputFileName);
}

try {
    convertPipelineResultFileToSarifFile(pipelineInputFileName,sarifOutputFileName);
} catch (error) {
    core.setFailed(error.message);
}

module.exports = {
    convertToSarif: convertPipelineResultFileToSarifFile
}