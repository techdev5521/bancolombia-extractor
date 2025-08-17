#!/usr/bin/env python3
import json, os, subprocess
from pathlib import Path

print("\nTransforming locales\n")
# {
#   "MESSAGE_KEY": {
#       "LOCALE": "MESSAGE_IN_LOCALE"
#   }
# }
translations = json.load(open("translations.json"))

# Get unique locales
all_locales = []
for message in translations.values():
    for locale in message.keys():
        all_locales.append(locale)
unique_locales = list(set(all_locales))

# Transform messages into output format:
# {
#     "LOCALE": { "MESSAGE_KEY": {"message": "MESSAGE_IN_LOCALE"} }
# }
outputs = {}
for locale in unique_locales:
    for key, message in translations.items():
        if locale not in outputs.keys():
            outputs[locale] = {}

        outputs[locale][key] = {"message": message[locale]}

# Make sure directories exit
locales_dir = "_locales"
if not os.path.exists(locales_dir):
    print(f"Creating locales directory '{locales_dir}'")
    os.mkdir(locales_dir)
for locale in outputs.keys():
    locale_dir = Path(locales_dir, locale)
    if not os.path.exists(locale_dir):
        print(f"Creating locales directory '{locale_dir}'")
        os.mkdir(locale_dir)

# Write messages to locale specific files
for locale, messages in outputs.items():
    with open(Path(locales_dir, locale, "messages.json"), "w") as locale_file:
        print(f"Writing locale file '{locale_file.name}'")
        json.dump(messages, locale_file, indent=4)



# Check for unused messages
for message in translations:
    message_in_manifest = not bool(subprocess.run(["grep", f"__MSG_{message}__", "manifest.json"], 
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode)
    message_in_html = not bool(subprocess.run(["grep", f"data-i18n-id=\"{message}\"", "popup.html"], 
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode)
    message_in_js = not bool(subprocess.run(f"grep 'chrome.i18n.getMessage(\"{message}\")' *.js",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode)

    if not message_in_manifest and not message_in_html and not message_in_js:
        print(f"WARNING: Message '{message}' is unused.")

print("\nFinished transforming locales")