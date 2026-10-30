terraform {
  required_version = ">= 1.5"

  backend "s3" {
    key = "clover-site.tfstate"
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  default_tags {
    tags = local.tags
  }
}

locals {
  environment_name = "production"
  fqdn             = "${var.hostname}.${var.domain_name}"

  tags = merge(
    {
      Component = "clover",
      Git       = "github.com/nulib-ds/clover",
      Project   = "Clover"
    },
    var.tags
  )
}

data "aws_route53_zone" "site" {
  name         = var.domain_name
  private_zone = false
}

resource "aws_s3_bucket" "site" {
  bucket = local.fqdn
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id

  versioning_configuration {
    status = "Enabled"
  }
}

# The bucket stays private; CloudFront reaches it through an origin access control.
resource "aws_cloudfront_origin_access_control" "site" {
  name                              = local.fqdn
  description                       = "Origin access control for ${local.fqdn}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_iam_policy_document" "site" {
  statement {
    sid       = "AllowCloudFrontRead"
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.site.arn}/*"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id
  policy = data.aws_iam_policy_document.site.json

  depends_on = [aws_s3_bucket_public_access_block.site]
}

resource "aws_acm_certificate" "site_certificate" {
  domain_name       = local.fqdn
  validation_method = "DNS"
}

resource "aws_route53_record" "site_certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.site_certificate.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }

  zone_id = data.aws_route53_zone.site.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]
}

resource "aws_acm_certificate_validation" "site_certificate_validation" {
  certificate_arn         = aws_acm_certificate.site_certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.site_certificate_validation : record.fqdn]
}

# S3 behind an origin access control serves keys, not directories: a page's address
# has to be put back to its file. See `rewrite.js`.
resource "aws_cloudfront_function" "rewrite" {
  name    = "${replace(local.fqdn, ".", "-")}-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "Static-export URLs to S3 keys for ${local.fqdn}"
  publish = true
  code    = file("${path.module}/rewrite.js")
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# The security headers, and CORS open to any origin: the mocks and the 3.x fixtures are
# IIIF resources published for any viewer to open, which needs CORS.
data "aws_cloudfront_response_headers_policy" "security" {
  name = "Managed-CORS-and-SecurityHeadersPolicy"
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = local.fqdn
  default_root_object = var.index_document
  price_class         = var.price_class
  aliases             = [local.fqdn]

  origin {
    origin_id                = "s3-${aws_s3_bucket.site.id}"
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  default_cache_behavior {
    target_origin_id           = "s3-${aws_s3_bucket.site.id}"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.security.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.rewrite.arn
    }
  }

  # The site is a static export: a missing path is served the exported 404 page,
  # which forwards URLs that moved.
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/${var.error_document}"
    error_caching_min_ttl = 60
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/${var.error_document}"
    error_caching_min_ttl = 60
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.site_certificate.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

resource "aws_route53_record" "site" {
  for_each = toset(["A", "AAAA"])

  zone_id = data.aws_route53_zone.site.zone_id
  name    = local.fqdn
  type    = each.key

  alias {
    name                   = aws_cloudfront_distribution.site.domain_name
    zone_id                = aws_cloudfront_distribution.site.hosted_zone_id
    evaluate_target_health = false
  }
}
