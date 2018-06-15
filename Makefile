GET=curl
NODEJS=node

BROWSERIFY = ./node_modules/.bin/browserify

TARGETS = \
	web/app.js

all: $(TARGETS)

web: web/app.js

web/app.js: web/init.js lib/*.js
	$(BROWSERIFY) -e web/init.js > $@

clean:
	rm -f $(TARGETS)

test: test/sparql11-test-suite

test/sparql11-test-suite:
	$(GET) 'https://www.w3.org/2009/sparql/docs/tests/sparql11-test-suite-20121023.tar.gz' | tar -zx -C test -f -

.PHONY : all web clean test
