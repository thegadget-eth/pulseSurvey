#!/bin/bash

# Select the crontab file
CRON_FILE="crontab"

# Create crontab file
echo "$TIMECRON export $(xargs < /var/www/botComm/.env); bash /var/www/botComm/start-bot.sh" >> $CRON_FILE

echo "Loading crontab file"

# Remove commented-out lines
grep -v '^#' $CRON_FILE

# Load the crontab file
crontab $CRON_FILE

echo "Starting cron..."

# Start cron
cron -f
