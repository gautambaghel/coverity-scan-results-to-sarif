# coverity-scan-results-to-sarif

Converts Coverity results to SARIF standard

This repository converts the output of the command "cov-format-errors --dir idir --json-output-v7 output.json" for GitHub to ingest.

It should also work with Polaris as long as underlying SAST technology uses Coverity.


## Example on how to run & test this Action locally

```

env INPUT_PIPELINE-RESULTS-JSON="coverity-results.json" INPUT_OUTPUT-RESULTS-SARIF="coverity-results-sarif.json" node index.js

```

where coverity-results.json -> results you get from coverity

coverity-results-sarif.json -> name of the o/p sarif file 


## An example workflow for coverity can be as following

```

# This workflow will build a Java project with Maven
# For more information see: https://help.github.com/actions/language-and-framework-guides/building-and-testing-java-with-maven

name: Insecure Bank CI with Coverity on Public runner

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

jobs:
  build:

    runs-on: ubuntu-latest
    env:
      COVERITY_SERVER_URL: http://coverity.synopsys-alliances.com
      COVERITY_USER: gautam
      COVERITY_PASSPHRASE: ${{ secrets.COVERITY_PASSPHRASE }}
      COVBIN: cov-analysis/2020.09/bin
      COVERITY_STREAM: insecure-bank
      BLDCMD: mvn -B clean compile
      CHECKERS: --all --webapp-security

    steps:
    - uses: actions/checkout@v2
    - name: Cache Coverity Analysis
      id: coverity-cache
      uses: actions/cache@v2
      with:
        path: |
          cov-analysis/
        key: coverity-cache-ubuntu

    - name: Download Coverity
      if: steps.coverity-cache.outputs.cache-hit != 'true'
      run: |
          mkdir cov-analysis/
          cd cov-analysis/
          curl -k --user $COVERITY_USER:$COVERITY_PASSPHRASE -o license.dat $COVERITY_SERVER_URL/downloadFile.htm?fn=license.dat
          curl -k --user $COVERITY_USER:$COVERITY_PASSPHRASE $COVERITY_SERVER_URL/downloadFile.htm?fn=cov-analysis-linux64-2020.09.tar.gz | tar -xvf -
          cp license.dat 2020.09/bin/
    - name: Coverity BAC
      run: |
        rm -rf idir
        $COVBIN/cov-build --dir idir $BLDCMD
        $COVBIN/cov-analyze --dir idir --ticker-mode none --strip-path $PWD $CHECKERS
        $COVBIN/cov-commit-defects --dir idir --ticker-mode none --url $COVERITY_SERVER_URL --stream $COVERITY_STREAM --encryption none --user $COVERITY_USER --password $COVERITY_PASSPHRASE
        $COVBIN/cov-format-errors --dir idir --json-output-v7 coverity-results.json
    - name: Convert Coverity Results to SARIF
      uses: gautambaghel/coverity-scan-results-to-sarif@1.0.0
      with:
        pipeline-results-json: coverity-results.json
        output-results-sarif: coverity-results.sarif
        
    - name: Upload SARIF file to GitHub UI
      uses: github/codeql-action/upload-sarif@v1
      with:
        sarif_file: coverity-results.sarif

```

## An example workflow for Polaris can be as following (incremental only)

```

name: Insecure Bank CI with Coverity on Public runner

on:
  push:
    branches: [ master ]
  pull_request:
    branches: [ master ]

jobs:
  build:

    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
          
    # Please note that the ID in previous step was set to prescription
    # in order for this logic to work also make sure that POLARIS_ACCESS_TOKEN
    # is defined in settings & polaris yml in the repo
    - name: Static Analysis with Polaris
      if: ${{steps.prescription.outputs.sastScan == 'true' }}
      run: |
          URL="https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${{ github.event.pull_request.number }}/files"
          FILES=$(curl -s -X GET -G $URL | jq -r '.[] | .filename')
          echo $FILES | tr " " "\n" > polaris-files-to-scan.txt
          echo "Files Changed -->"
          cat polaris-files-to-scan.txt
          export POLARIS_SERVER_URL=${{ secrets.POLARIS_SERVER_URL}}
          export POLARIS_ACCESS_TOKEN=${{ secrets.POLARIS_ACCESS_TOKEN}}
          export POLARIS_FF_ENABLE_COVERITY_INCREMENTAL=true
          wget -q ${{ secrets.POLARIS_SERVER_URL}}/api/tools/polaris_cli-linux64.zip
          unzip -j polaris_cli-linux64.zip -d 
          polaris analyze -w --incremental polaris-files-to-scan.txt | tee polaris-output.txt
          
    - name: Convert Coverity Results to SARIF
      uses: gautambaghel/coverity-scan-results-to-sarif@1.0.0
      with:
        pipeline-results-json: .synopsys/polaris/data/coverity/2020.09/idir/incremental-results/incremental-results.json
        output-results-sarif: polaris-results.sarif
        
    - name: Upload SARIF file to GitHub UI
      uses: github/codeql-action/upload-sarif@v1
      with:
        sarif_file: polaris-results.sarif

```
