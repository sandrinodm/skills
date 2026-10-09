FROM eclipse-temurin:17-jdk-jammy

ARG JADX_VERSION=1.5.5
ARG APKTOOL_VERSION=3.0.2
ARG ANDROID_CMDLINE_TOOLS_ZIP=commandlinetools-linux-13114758_latest.zip
ARG ANDROID_BUILD_TOOLS_VERSION=35.0.0

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${ANDROID_HOME}/build-tools/${ANDROID_BUILD_TOOLS_VERSION}:/opt/jadx/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    ripgrep \
    unzip \
    file \
    binutils \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
  && curl -fsSLo /tmp/android-commandline-tools.zip "https://dl.google.com/android/repository/${ANDROID_CMDLINE_TOOLS_ZIP}" \
  && unzip -q /tmp/android-commandline-tools.zip -d /tmp/android-commandline-tools \
  && mv /tmp/android-commandline-tools/cmdline-tools "${ANDROID_HOME}/cmdline-tools/latest" \
  && rm -rf /tmp/android-commandline-tools /tmp/android-commandline-tools.zip \
  && (yes | sdkmanager --sdk_root="${ANDROID_HOME}" --licenses >/dev/null || true) \
  && sdkmanager --sdk_root="${ANDROID_HOME}" \
    "platform-tools" \
    "build-tools;${ANDROID_BUILD_TOOLS_VERSION}"

RUN curl -fsSLo /tmp/jadx.zip "https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip" \
  && mkdir -p /opt/jadx \
  && unzip -q /tmp/jadx.zip -d /opt/jadx \
  && chmod +x /opt/jadx/bin/jadx /opt/jadx/bin/jadx-gui \
  && rm /tmp/jadx.zip

RUN curl -fsSLo /usr/local/bin/apktool.jar "https://github.com/iBotPeaches/Apktool/releases/download/v${APKTOOL_VERSION}/apktool_${APKTOOL_VERSION}.jar" \
  && printf '%s\n' '#!/usr/bin/env sh' 'exec java -jar /usr/local/bin/apktool.jar "$@"' > /usr/local/bin/apktool \
  && chmod +x /usr/local/bin/apktool

COPY docker/apk-tools/pull-package-apks.sh /usr/local/bin/pull-package-apks

RUN chmod +x /usr/local/bin/pull-package-apks

WORKDIR /work

CMD ["/bin/bash"]
