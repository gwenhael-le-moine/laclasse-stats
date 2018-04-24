all: js/app.min.js

# find ts -type f -exec echo -n {}\  \;
js/app.js: ts/app.ts ts/config.ts tsconfig.json
	-./node_modules/.bin/tsc --project ./tsconfig.json

js/app.min.js: js/app.js
	-./node_modules/.bin/google-closure-compiler-js $^ > $@

pull-deps:
	-npm install

clean:
	-rm js/app.min.js js/app.js

clean-all: clean
	-rm -fr node_modules
