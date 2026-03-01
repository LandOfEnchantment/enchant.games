build:
	@sh scripts/build.sh

run: build
	python3 serve.py
