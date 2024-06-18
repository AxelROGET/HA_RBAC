ARG BUILD_FROM
FROM $BUILD_FROM

# Install requirements for add-on
RUN \
    apk add --no-cache \
        python3

# Python 3 HTTP Server serves the current working dir
# So let's set it to out add-on persistent data directory.
# WORKDIR /data

# Copy data for add-on
COPY run.sh /
COPY main.py /
COPY web /web
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]