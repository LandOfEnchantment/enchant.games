build:
	@(printf '['; sep=''; for f in pages/*.yml; do printf '%s"%s"' "$$sep" "$$(basename $$f)"; sep=','; done; printf ']\n') > pages.json
	@(printf '['; sep=''; for f in news/*.yml; do printf '%s"%s"' "$$sep" "$$(basename $$f)"; sep=','; done; printf ']\n') > news.json
	@echo "Built pages.json and news.json"

run: build
	python3 serve.py
