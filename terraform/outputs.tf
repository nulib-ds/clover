output "site_url" {
  description = "Public URL of the site."
  value       = "https://${local.fqdn}"
}

output "fqdn" {
  description = "Fully qualified host name of the site."
  value       = local.fqdn
}

output "bucket_name" {
  description = "Name of the S3 bucket holding the built site."
  value       = aws_s3_bucket.site.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket holding the built site."
  value       = aws_s3_bucket.site.arn
}

output "distribution_id" {
  description = "CloudFront distribution id, for cache invalidation after a deploy."
  value       = aws_cloudfront_distribution.site.id
}

output "distribution_domain_name" {
  description = "CloudFront's own domain name for the distribution."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "zone_id" {
  description = "Route 53 hosted zone the record was written to."
  value       = data.aws_route53_zone.site.zone_id
}
