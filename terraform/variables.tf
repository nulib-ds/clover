variable "hostname" {
  description = "Host portion of the site's name (e.g. \"clover\" for clover.example.edu)."
  type        = string
}

variable "domain_name" {
  description = "Domain the site lives in. A Route 53 public hosted zone for it must already exist."
  type        = string
}

variable "index_document" {
  description = "Object served for the site root."
  type        = string
  default     = "index.html"
}

variable "error_document" {
  description = "Object served when a path is not found. The docs site exports 404.html."
  type        = string
  default     = "404.html"
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
  default     = {}
}
