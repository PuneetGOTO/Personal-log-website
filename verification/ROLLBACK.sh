#!/usr/bin/env sh
set -eu
node -e "const fs=require('fs'); fs.copyFileSync('verification/ORIGINAL_FILE.txt','verification/ROLLBACK_TEST_FILE.txt'); console.log('rollback-restored='+fs.readFileSync('verification/ROLLBACK_TEST_FILE.txt','utf8').split(/\\r?\\n/)[1]);"
