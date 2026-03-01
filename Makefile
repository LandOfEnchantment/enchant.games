build:
	@(printf '['; sep=''; for f in pages/*.yml; do printf '%s"%s"' "$$sep" "$$(basename $$f)"; sep=','; done; printf ']\n') > pages.json
	@(printf '['; sep=''; for f in news/*.yml; do printf '%s"%s"' "$$sep" "$$(basename $$f)"; sep=','; done; printf ']\n') > news.json
	@echo "Built pages.json and news.json"
	@sh scripts/build-feeds.sh

run: build
	python3 serve.py
