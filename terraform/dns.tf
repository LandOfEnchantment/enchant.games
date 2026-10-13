# Every record in the zone. The site's: GitHub Pages' four A and four AAAA addresses at the
# apex and www as a CNAME to the organization's Pages host, all proxied. Email Routing's:
# the three MX, SPF, DKIM (cf2024-1, which Email Routing created and Cloudflare marks read
# only) and DMARC. And Google's site verification.

resource "cloudflare_dns_record" "pages_a_108" {
  comment         = null
  content         = "185.199.108.153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "A"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "pages_a_109" {
  comment         = null
  content         = "185.199.109.153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "A"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "pages_a_110" {
  comment         = null
  content         = "185.199.110.153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "A"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "pages_a_111" {
  comment         = null
  content         = "185.199.111.153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "A"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "pages_aaaa_8000" {
  comment         = null
  content         = "2606:50c0:8000::153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "AAAA"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "pages_aaaa_8001" {
  comment         = null
  content         = "2606:50c0:8001::153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "AAAA"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "pages_aaaa_8002" {
  comment         = null
  content         = "2606:50c0:8002::153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "AAAA"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "pages_aaaa_8003" {
  comment         = null
  content         = "2606:50c0:8003::153"
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "AAAA"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "www" {
  comment         = null
  content         = "landofenchantment.github.io"
  data            = null
  name            = "www.enchant.games"
  priority        = null
  private_routing = null
  proxied         = true
  settings = {
    flatten_cname = false
    ipv4_only     = false
    ipv6_only     = false
  }
  tags    = []
  ttl     = 1
  type    = "CNAME"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "mx_route1" {
  comment         = null
  content         = "route1.mx.cloudflare.net"
  data            = null
  name            = "enchant.games"
  priority        = 95
  private_routing = null
  proxied         = false
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "MX"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "mx_route2" {
  comment         = null
  content         = "route2.mx.cloudflare.net"
  data            = null
  name            = "enchant.games"
  priority        = 34
  private_routing = null
  proxied         = false
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "MX"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "mx_route3" {
  comment         = null
  content         = "route3.mx.cloudflare.net"
  data            = null
  name            = "enchant.games"
  priority        = 90
  private_routing = null
  proxied         = false
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "MX"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "spf" {
  comment         = null
  content         = "\"v=spf1 include:_spf.mx.cloudflare.net ~all\""
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = false
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "TXT"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "dkim_cf2024" {
  comment         = null
  content         = "\"v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAiweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJvdg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bznU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78k\" \"m4KXwaf9xUJCWF6nxeD+qG6Fyruw1Qlbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB\""
  data            = null
  name            = "cf2024-1._domainkey.enchant.games"
  priority        = null
  private_routing = null
  proxied         = false
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "TXT"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "dmarc" {
  comment         = null
  content         = "\"v=DMARC1; p=none; rua=mailto:880fc254f27a44298581e3cc0a81d36f@dmarc-reports.cloudflare.net\""
  data            = null
  name            = "_dmarc.enchant.games"
  priority        = null
  private_routing = null
  proxied         = false
  settings = {
  }
  tags    = []
  ttl     = 1
  type    = "TXT"
  zone_id = var.zone_id
}

resource "cloudflare_dns_record" "google_site_verification" {
  comment         = null
  content         = "\"google-site-verification=OrZefnKPGGr65RYsEau49gQub2C2_5Z3lBREcIubQ80\""
  data            = null
  name            = "enchant.games"
  priority        = null
  private_routing = null
  proxied         = false
  settings = {
  }
  tags    = []
  ttl     = 3600
  type    = "TXT"
  zone_id = var.zone_id
}
