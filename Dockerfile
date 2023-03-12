kFROM node:17.9.1

RUN apt-get update && apt-get -y upgrade
RUN apt -y install cron

RUN mkdir -p "/var/www/botComm"
RUN mkdir "/var/www/cron-log"

WORKDIR "/var/www/botComm"

COPY package*.json ./

RUN npm ci --only=production

COPY . .

RUN find . -type f -iname "*.sh" -exec chmod +x {} \;

ENV TIMECRON="* * * * *"

CMD ["./start.sh"]
