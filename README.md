# Good Enough Notebook (GEN)

GEN is a collection of no-brand personal utilities, not for "productivity" per se, but for getting your mind off of things you aren't working on right now.

[![Build](https://github.com/brendanlandis/good-enough-notebook/actions/workflows/build.yml/badge.svg)](https://github.com/brendanlandis/good-enough-notebook/actions/workflows/build.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

![header](docs/header.png)

Parts of this app work pretty well, parts are still being prototyped:

- **Todo list:** Works pretty well.
- **Practice routine tracker:** Works ok.
- **Free-writing notepad:** Works ok.

Right now the only way to use this is to download and install it yourself, but in time it will be a web site you can visit and create an account on.

## The idea

We all have a lot going on, and it's easy to feel overwhelmed. We know this already.

Uncluttered software is good, yes, but more lacking in our lives is *humane* software.

I started building this because I need to stop thinking about ten other things while I'm trying to write music, or focus on a coding problem, or hang out with friends. Whatever I'm doing on any given day, I just want to be doing that thing, without thinking about the myriad other things I "should" be doing.

I've always needed a place where I could put all my *stuff* that I could actually *trust* and use without having to click too much. There are a lot of todo list apps out there, but it always felt weird trying to fit my stuff into them - some were simpler than what I needed, others more complex. And they were all so concerned with *productivity*.

I'm not worried about productivity. I'm worried about being *present* with what I'm doing. I want to be able to really choose what I do with my time, not run around trying to do ten things at once and then scrollbrain-dissociate to "relax" afterwards. I wanna read more books, you know?

So, I'm making a small suite of tools for myself that will help quiet the part of my brain that worries about doing ten different things *even while I'm trying to do one of the ten things* (ridiculous!).

## The plan

- Make something I personally want to use, make it so other people can use it if they want to as well.
- Make two versions: An open-source version you can download and self-host, and down the road, a hosted version you can make an account on and use for maybe something like $5 / month.
- No ads, no AI anything, no branding, no extra buttons, no tracking, no nagging, no clutter, no app, no popups, no stupid emails, just a little web site. A little web site is enough.
- Open formats, easy to export your data and delete your account, etc.
- Just generally treat people that use this web site with respect and dignity.

As of this writing, the project is at v0.1, so this is mostly future-tense stuff. But, that's the plan.

## Usage

If you'd like to use the current version, there is a bit of setup:
- The backend runs on Strapi, which you'll need to get up and running, and talking to a database. Strapi is pretty good about auto-configuring this stuff for development, and if you just `cd backend` and `npm install` and `npm run develop`, it may just work out of the box.
- Check out the `.env.example` file, which you'll want to configure and rename to `.env`. I've set Strapi up to use AWS for storing media, maybe you'll want to do the same, or not, but either way, the config is in there.
- Open up Strapi, make a user, remember your username.
- With Strapi running, you'll then need to `cd` into the `/frontend` directory, and do another `npm install` and `npm run dev` (not `develop` this time).
- The `/frontend` app has another `.env.example` file, which you'll want to configure and rename to `.env`.