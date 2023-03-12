#!/bin/bash

echo "$(date) start bot job" 2>&1 | tee -a /var/www/cron-log/bot-log.txt
cd /var/www/botComm/
/usr/local/bin/node index.js 2>&1 | tee -a /var/www/cron-log/bot-log.txt
echo "$(date) start analyzer"  2>&1 | tee -a /var/www/cron-log/bot-log.txt
curl http://$ANALYZER_ADDRESS/ 2>&1 | tee -a /var/www/cron-log/bot-log.txt
