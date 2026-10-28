# Contributing to Clover

## Questions

If you have questions about Clover, be sure to check out the docs where we have several examples and detailed API references that may help you solve your problem.

## How to contribute

There are many ways to contribute to the project. Code is just one possible means of contribution.

- **Feedback.** Tell us what we're doing well or where we can improve.
- **Support.** Please reach out to `@mat` in the [IIIF Slack workspace](https://iiif.slack.com) or submit a new issue in [open issues](https://github.com/nulib-ds/clover/issues).
- **Write.** If you come up with an interesting example, write about it. Post it to your blog and share it with us. We'd love to see what folks in the community build with Clover!
- **Report.** Create issues with bug reports so we can make Clover even better.

## Working on your first Pull Request?

There are a lot of great resources on creating a good pull request. We've included a few below, but don't be shy—we appreciate all contriibutions and are happy to help those who are willing to help us!

- [How to Contribute to a Project on GitHub](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github)

## Preparing a Pull Request

[Pull Requests](https://docs.github.com/en/free-pro-team@latest/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request) are always welcome, but before working on a large change, it is best to open an issue first to discuss it with maintainers.

A good PR is small, focuses on a single feature or improvement, and clearly communicates the problem it solves. Try not to include more than one issue in a single PR. It's much easier for us to review multiple small pull requests than one that is large and unwieldy.

1. [Fork the repository](https://docs.github.com/en/free-pro-team@latest/github/getting-started-with-github/fork-a-repo).

2. Clone the fork to your local machine and add upstream remote:

```sh
git clone https://github.com/<your username>/clover.git
cd clover
git remote add upstream https://github.com/nulib-ds/clover.git
```

1. Synchronize your local `main` branch with the upstream remote:

```sh
git checkout main
git pull upstream main
```

1. Make sure your Node version is 20.10 or later (`engines` in [package.json](../package.json)).

```
node -v
```

1. Install dependencies:

```sh
npm install
```

1. Create a new branch related to your PR:

```sh
git checkout -b my-bug-fix
```

6. Make changes, then commit and push to your forked repository:

```sh
git push -u origin HEAD
```

7. Go to [the repository](https://github.com/nulib-ds/clover) and [make a Pull Request](https://docs.github.com/en/free-pro-team@latest/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request).

8. We will review your Pull Request and either merge it, request changes to it, or close it with an explanation.

## Working locally

The repository is an npm workspace: the package, `@nulib/clover`, is in `packages/clover`, and its documentation site is at the root.

### Development

```bash
# install dependencies
npm install

# start Nextra-based docs and see examples in the browser
npm run dev
```

Make your changes and check that they resolve the problem with an example in the docs. We also suggest adding tests to support your change, and then run `npm run test` to make sure nothing is broken.

Lastly, run `npm run build` to ensure that the build runs successfully before submitting the pull request.
