#!/bin/bash
# APK uchun statik eksport build
# - API routelar server'ga bog'liq — vaqtincha chetlatiladi
# - public/*.apk fayllar APK ichiga kirib ketmasin — vaqtincha chetlatiladi
cd /home/z/my-project

echo "── API routelarni vaqtincha chetlatish ──"
rm -rf /tmp/api-backup /tmp/apk-backup
mkdir -p /tmp/api-backup /tmp/apk-backup
if [ -d src/app/api ]; then
  mv src/app/api /tmp/api-backup/api
fi
if ls public/*.apk > /dev/null 2>&1; then
  mv public/*.apk /tmp/apk-backup/
fi

restore_all () {
  if [ -d /tmp/api-backup/api ] && [ ! -d src/app/api ]; then
    mv /tmp/api-backup/api src/app/api
    echo "── API routelar qaytarildi ──"
  fi
  if ls /tmp/apk-backup/*.apk > /dev/null 2>&1; then
    mv /tmp/apk-backup/*.apk public/
    echo "── APK fayl public/ ga qaytarildi ──"
  fi
}
trap restore_all EXIT

echo "── Statik eksport build (APK_BUILD=1) ──"
if APK_BUILD=1 bunx next build; then
  echo "── out/ tayyor ──"
  ls out/ | head -20
else
  echo "BUILD FAILED"
  exit 1
fi
