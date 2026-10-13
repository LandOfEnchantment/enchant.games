# The zone's rulesets, one per phase (was scripts/cloudflare-settings.sh, 2026-10-11/12).

# A keyed address (?v=<its content's key>, scripts/build.js) is kept by browsers for a day,
# since its address changes whenever its bytes do. A day, not a year and not immutable: a
# browser cache can't be purged, so a key that ever went wrong must expire on its own. Never
# the pages, version.json, the feed or the sitemap. The edge keeps GitHub's ten minutes;
# deploy.yml purges it.

resource "cloudflare_ruleset" "cache_settings" {
  account_id = null
  kind       = "zone"
  name       = "default"
  phase      = "http_request_cache_settings"
  rules = [
    {
      action = "set_cache_settings"
      action_parameters = {
        additional_cacheable_ports = null
        algorithms                 = null
        asset_name                 = null
        automatic_https_rewrites   = null
        autominify                 = null
        bic                        = null
        browser_ttl = {
          default = 86400
          mode    = "override_origin"
        }
        cache                      = null
        cache_key                  = null
        cache_reserve              = null
        content                    = null
        content_converter          = null
        content_type               = null
        cookie_fields              = null
        disable_apps               = null
        disable_rum                = null
        disable_zaraz              = null
        edge_ttl                   = null
        email_obfuscation          = null
        expression                 = null
        fonts                      = null
        from_list                  = null
        from_value                 = null
        headers                    = null
        host_header                = null
        hotlink_protection         = null
        id                         = null
        immutable                  = null
        increment                  = null
        matched_data               = null
        max_age                    = null
        mirage                     = null
        must_revalidate            = null
        must_understand            = null
        no_cache                   = null
        no_store                   = null
        no_transform               = null
        operation                  = null
        opportunistic_encryption   = null
        origin                     = null
        origin_cache_control       = null
        origin_error_page_passthru = null
        overrides                  = null
        phases                     = null
        polish                     = null
        private                    = null
        products                   = null
        proxy_revalidate           = null
        public                     = null
        raw_response_fields        = null
        read_timeout               = null
        redirects_for_ai_training  = null
        request_body_buffering     = null
        request_fields             = null
        respect_strong_etags       = null
        response                   = null
        response_body_buffering    = null
        response_fields            = null
        rocket_loader              = null
        rules                      = null
        ruleset                    = null
        rulesets                   = null
        s_maxage                   = null
        security_level             = null
        serve_stale                = null
        server_side_excludes       = null
        sni                        = null
        ssl                        = null
        stale_if_error             = null
        stale_while_revalidate     = null
        status_code                = null
        strip_etags                = null
        strip_last_modified        = null
        strip_set_cookie           = null
        sxg                        = null
        transformed_request_fields = null
        uri                        = null
        values                     = null
        vary                       = null
      }
      description              = "Keyed scripts, styles, fonts and pictures (?v=<content key>, scripts/build.js): a day in the browser. Never a page, version.json, the feed or the sitemap."
      enabled                  = true
      exposed_credential_check = null
      expression               = "(http.request.uri.query contains \"v=\" and (ends_with(http.request.uri.path, \".js\") or ends_with(http.request.uri.path, \".css\") or ends_with(http.request.uri.path, \".woff2\") or ends_with(http.request.uri.path, \".webp\") or ends_with(http.request.uri.path, \".png\") or ends_with(http.request.uri.path, \".jpg\")))"
      ratelimit                = null
      ref                      = "2683e1335456431787b2a71492d9451d"
    },
  ]
  zone_id = var.zone_id
}

# The old addresses 301'd to the pages' own (2026-10-12, when the build began drawing every
# page at its address): /?slug=<page> to /<page>/, /?slug=home to /, /?slug=journal (or
# news) to /journal/, and /?slug=journal&article=<slug> to /journal/<slug>/. What these miss
# (an article named with its .yml, which the old site forgave) lands on the home page, whose
# head sends it on (scripts/build.js). www already 301s to the bare domain with its query, so
# these see it too. A retired page's address forwards from the page the build writes there
# (redirects.yml).

resource "cloudflare_ruleset" "redirects" {
  account_id = null
  kind       = "zone"
  name       = "default"
  phase      = "http_request_dynamic_redirect"
  rules = [
    {
      action = "redirect"
      action_parameters = {
        additional_cacheable_ports = null
        algorithms                 = null
        asset_name                 = null
        automatic_https_rewrites   = null
        autominify                 = null
        bic                        = null
        browser_ttl                = null
        cache                      = null
        cache_key                  = null
        cache_reserve              = null
        content                    = null
        content_converter          = null
        content_type               = null
        cookie_fields              = null
        disable_apps               = null
        disable_rum                = null
        disable_zaraz              = null
        edge_ttl                   = null
        email_obfuscation          = null
        expression                 = null
        fonts                      = null
        from_list                  = null
        from_value = {
          preserve_query_string = false
          status_code           = 301
          target_url = {
            expression = "concat(\"https://enchant.games/journal/\", http.request.uri.args[\"article\"][0], \"/\")"
            value      = null
          }
        }
        headers                    = null
        host_header                = null
        hotlink_protection         = null
        id                         = null
        immutable                  = null
        increment                  = null
        matched_data               = null
        max_age                    = null
        mirage                     = null
        must_revalidate            = null
        must_understand            = null
        no_cache                   = null
        no_store                   = null
        no_transform               = null
        operation                  = null
        opportunistic_encryption   = null
        origin                     = null
        origin_cache_control       = null
        origin_error_page_passthru = null
        overrides                  = null
        phases                     = null
        polish                     = null
        private                    = null
        products                   = null
        proxy_revalidate           = null
        public                     = null
        raw_response_fields        = null
        read_timeout               = null
        redirects_for_ai_training  = null
        request_body_buffering     = null
        request_fields             = null
        respect_strong_etags       = null
        response                   = null
        response_body_buffering    = null
        response_fields            = null
        rocket_loader              = null
        rules                      = null
        ruleset                    = null
        rulesets                   = null
        s_maxage                   = null
        security_level             = null
        serve_stale                = null
        server_side_excludes       = null
        sni                        = null
        ssl                        = null
        stale_if_error             = null
        stale_while_revalidate     = null
        status_code                = null
        strip_etags                = null
        strip_last_modified        = null
        strip_set_cookie           = null
        sxg                        = null
        transformed_request_fields = null
        uri                        = null
        values                     = null
        vary                       = null
      }
      description              = "An old article address (/?slug=journal&article=<slug>) to /journal/<slug>/"
      enabled                  = true
      exposed_credential_check = null
      expression               = "http.host eq \"enchant.games\" and http.request.uri.path eq \"/\" and any(http.request.uri.args[\"slug\"][*] in {\"journal\" \"news\"}) and len(http.request.uri.args[\"article\"][0]) gt 0 and not ends_with(http.request.uri.args[\"article\"][0], \".yml\")"
      ratelimit                = null
      ref                      = "3f3067b36019418e85315d1559772317"
    },
    {
      action = "redirect"
      action_parameters = {
        additional_cacheable_ports = null
        algorithms                 = null
        asset_name                 = null
        automatic_https_rewrites   = null
        autominify                 = null
        bic                        = null
        browser_ttl                = null
        cache                      = null
        cache_key                  = null
        cache_reserve              = null
        content                    = null
        content_converter          = null
        content_type               = null
        cookie_fields              = null
        disable_apps               = null
        disable_rum                = null
        disable_zaraz              = null
        edge_ttl                   = null
        email_obfuscation          = null
        expression                 = null
        fonts                      = null
        from_list                  = null
        from_value = {
          preserve_query_string = false
          status_code           = 301
          target_url = {
            expression = null
            value      = "https://enchant.games/journal/"
          }
        }
        headers                    = null
        host_header                = null
        hotlink_protection         = null
        id                         = null
        immutable                  = null
        increment                  = null
        matched_data               = null
        max_age                    = null
        mirage                     = null
        must_revalidate            = null
        must_understand            = null
        no_cache                   = null
        no_store                   = null
        no_transform               = null
        operation                  = null
        opportunistic_encryption   = null
        origin                     = null
        origin_cache_control       = null
        origin_error_page_passthru = null
        overrides                  = null
        phases                     = null
        polish                     = null
        private                    = null
        products                   = null
        proxy_revalidate           = null
        public                     = null
        raw_response_fields        = null
        read_timeout               = null
        redirects_for_ai_training  = null
        request_body_buffering     = null
        request_fields             = null
        respect_strong_etags       = null
        response                   = null
        response_body_buffering    = null
        response_fields            = null
        rocket_loader              = null
        rules                      = null
        ruleset                    = null
        rulesets                   = null
        s_maxage                   = null
        security_level             = null
        serve_stale                = null
        server_side_excludes       = null
        sni                        = null
        ssl                        = null
        stale_if_error             = null
        stale_while_revalidate     = null
        status_code                = null
        strip_etags                = null
        strip_last_modified        = null
        strip_set_cookie           = null
        sxg                        = null
        transformed_request_fields = null
        uri                        = null
        values                     = null
        vary                       = null
      }
      description              = "The old journal address (/?slug=journal, or news) to /journal/"
      enabled                  = true
      exposed_credential_check = null
      expression               = "http.host eq \"enchant.games\" and http.request.uri.path eq \"/\" and any(http.request.uri.args[\"slug\"][*] in {\"journal\" \"news\"}) and not len(http.request.uri.args[\"article\"]) ge 0"
      ratelimit                = null
      ref                      = "11f2933a81694f74ac5295ae1a301914"
    },
    {
      action = "redirect"
      action_parameters = {
        additional_cacheable_ports = null
        algorithms                 = null
        asset_name                 = null
        automatic_https_rewrites   = null
        autominify                 = null
        bic                        = null
        browser_ttl                = null
        cache                      = null
        cache_key                  = null
        cache_reserve              = null
        content                    = null
        content_converter          = null
        content_type               = null
        cookie_fields              = null
        disable_apps               = null
        disable_rum                = null
        disable_zaraz              = null
        edge_ttl                   = null
        email_obfuscation          = null
        expression                 = null
        fonts                      = null
        from_list                  = null
        from_value = {
          preserve_query_string = false
          status_code           = 301
          target_url = {
            expression = null
            value      = "https://enchant.games/"
          }
        }
        headers                    = null
        host_header                = null
        hotlink_protection         = null
        id                         = null
        immutable                  = null
        increment                  = null
        matched_data               = null
        max_age                    = null
        mirage                     = null
        must_revalidate            = null
        must_understand            = null
        no_cache                   = null
        no_store                   = null
        no_transform               = null
        operation                  = null
        opportunistic_encryption   = null
        origin                     = null
        origin_cache_control       = null
        origin_error_page_passthru = null
        overrides                  = null
        phases                     = null
        polish                     = null
        private                    = null
        products                   = null
        proxy_revalidate           = null
        public                     = null
        raw_response_fields        = null
        read_timeout               = null
        redirects_for_ai_training  = null
        request_body_buffering     = null
        request_fields             = null
        respect_strong_etags       = null
        response                   = null
        response_body_buffering    = null
        response_fields            = null
        rocket_loader              = null
        rules                      = null
        ruleset                    = null
        rulesets                   = null
        s_maxage                   = null
        security_level             = null
        serve_stale                = null
        server_side_excludes       = null
        sni                        = null
        ssl                        = null
        stale_if_error             = null
        stale_while_revalidate     = null
        status_code                = null
        strip_etags                = null
        strip_last_modified        = null
        strip_set_cookie           = null
        sxg                        = null
        transformed_request_fields = null
        uri                        = null
        values                     = null
        vary                       = null
      }
      description              = "The old home address (/?slug=home) to /"
      enabled                  = true
      exposed_credential_check = null
      expression               = "http.host eq \"enchant.games\" and http.request.uri.path eq \"/\" and any(http.request.uri.args[\"slug\"][*] eq \"home\")"
      ratelimit                = null
      ref                      = "4f57bd2cf76a41d9a998115917896671"
    },
    {
      action = "redirect"
      action_parameters = {
        additional_cacheable_ports = null
        algorithms                 = null
        asset_name                 = null
        automatic_https_rewrites   = null
        autominify                 = null
        bic                        = null
        browser_ttl                = null
        cache                      = null
        cache_key                  = null
        cache_reserve              = null
        content                    = null
        content_converter          = null
        content_type               = null
        cookie_fields              = null
        disable_apps               = null
        disable_rum                = null
        disable_zaraz              = null
        edge_ttl                   = null
        email_obfuscation          = null
        expression                 = null
        fonts                      = null
        from_list                  = null
        from_value = {
          preserve_query_string = false
          status_code           = 301
          target_url = {
            expression = "concat(\"https://enchant.games/\", http.request.uri.args[\"slug\"][0], \"/\")"
            value      = null
          }
        }
        headers                    = null
        host_header                = null
        hotlink_protection         = null
        id                         = null
        immutable                  = null
        increment                  = null
        matched_data               = null
        max_age                    = null
        mirage                     = null
        must_revalidate            = null
        must_understand            = null
        no_cache                   = null
        no_store                   = null
        no_transform               = null
        operation                  = null
        opportunistic_encryption   = null
        origin                     = null
        origin_cache_control       = null
        origin_error_page_passthru = null
        overrides                  = null
        phases                     = null
        polish                     = null
        private                    = null
        products                   = null
        proxy_revalidate           = null
        public                     = null
        raw_response_fields        = null
        read_timeout               = null
        redirects_for_ai_training  = null
        request_body_buffering     = null
        request_fields             = null
        respect_strong_etags       = null
        response                   = null
        response_body_buffering    = null
        response_fields            = null
        rocket_loader              = null
        rules                      = null
        ruleset                    = null
        rulesets                   = null
        s_maxage                   = null
        security_level             = null
        serve_stale                = null
        server_side_excludes       = null
        sni                        = null
        ssl                        = null
        stale_if_error             = null
        stale_while_revalidate     = null
        status_code                = null
        strip_etags                = null
        strip_last_modified        = null
        strip_set_cookie           = null
        sxg                        = null
        transformed_request_fields = null
        uri                        = null
        values                     = null
        vary                       = null
      }
      description              = "An old page address (/?slug=<page>) to /<page>/"
      enabled                  = true
      exposed_credential_check = null
      expression               = "http.host eq \"enchant.games\" and http.request.uri.path eq \"/\" and len(http.request.uri.args[\"slug\"][0]) gt 0 and not any(http.request.uri.args[\"slug\"][*] in {\"home\" \"journal\" \"news\"})"
      ratelimit                = null
      ref                      = "c7a8558b001841649b1dad6de93abf21"
    },
  ]
  zone_id = var.zone_id
}
