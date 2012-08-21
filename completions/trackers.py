#!/usr/bin/env python
#coding: utf8
#################################### IMPORTS ###################################

# Std Libs
import re

# Sublime Libs
import sublime
import sublime_plugin

from collections import defaultdict

################################### CONSTANTS ##################################

# Directions for tracker
BACK         =  -1
FORWARD      =   1

###################### VIEW TRACKERS ( CONTEXT SCANNERS ) ######################

def pt_range(view, start_pt, direction):
    end_pt = direction
    if end_pt != -1: end_pt = view.size()
    return xrange(start_pt, end_pt, direction)

def region_from_pt_list(l):
    if l:
        l = sorted(l)
        return sublime.Region(l[0], l[-1]+1)

def view_tracker(view, start_pt, *conds):
    pts = defaultdict(list)
    failed = False

    for i, (direction, condition) in enumerate(conds):
        for pt in pt_range(view, start_pt, direction):
            if failed: break

            if not condition(view, pt):
                if not pts[i]: failed = True
                start_pt = pt
                break

            if len(pts[i]) < 2:
                pts[i].append(pt)
            else:
                pts[i][-1] = pt

    return [ region_from_pt_list(pt_list) for pt_list in pts.values() ]

def tracker_success(regions):
    return all(r is not None for r in regions)

def back_track(view, start_pt, *conds):
    return view_tracker(view, start_pt -1, *((BACK, c) for c in conds))

################################### TRACKERS ###################################

def track_regex(r, cond=True):
    return lambda v, p: bool(re.match(r, v.substr(p))) is cond

def track_scope(s, cond=True):
    return lambda v, p: bool(v.match_selector(p, s)) is cond

################################################################################