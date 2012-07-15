#!/usr/bin/env python
# -*- coding: utf-8 -*-
from __future__ import with_statement

import sys, os, re

try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO

try:
    import json
except ImportError:
    import simplejson as json

import _PyV8

__author__ = 'Flier Lu <flier.lu@gmail.com>'
__version__ = '1.0'

__all__ = ["ReadOnly", "DontEnum", "DontDelete", "Internal",
           "JSError", "JSObject", "JSArray", "JSFunction",
           "JSClass", "JSEngine", "JSContext",
           "JSObjectSpace", "JSAllocationAction",
           "JSStackTrace", "JSStackFrame", "profiler", 
           "JSExtension", "JSLocker", "JSUnlocker", "AST"]

class JSAttribute(object):
    def __init__(self, name):
        self.name = name

    def __call__(self, func):
        setattr(func, "__%s__" % self.name, True)
        
        return func

ReadOnly = JSAttribute(name='readonly')
DontEnum = JSAttribute(name='dontenum')
DontDelete = JSAttribute(name='dontdel')
Internal = JSAttribute(name='internal')

class JSError(Exception):
    def __init__(self, impl):
        Exception.__init__(self)

        self._impl = impl

    def __str__(self):
        return str(self._impl)

    def __unicode__(self, *args, **kwargs):
        return unicode(self._impl)

    def __getattribute__(self, attr):
        impl = super(JSError, self).__getattribute__("_impl")

        try:
            return getattr(impl, attr)
        except AttributeError:
            return super(JSError, self).__getattribute__(attr)

    RE_FRAME = re.compile(r"\s+at\s(?:new\s)?(?P<func>.+)\s\((?P<file>[^:]+):?(?P<row>\d+)?:?(?P<col>\d+)?\)")
    RE_FUNC = re.compile(r"\s+at\s(?:new\s)?(?P<func>.+)\s\((?P<file>[^\)]+)\)")
    RE_FILE = re.compile(r"\s+at\s(?P<file>[^:]+):?(?P<row>\d+)?:?(?P<col>\d+)?")

    @staticmethod
    def parse_stack(value):
        stack = []

        def int_or_nul(value):
            return int(value) if value else None

        for line in value.split('\n')[1:]:
            m = JSError.RE_FRAME.match(line)

            if m:
                stack.append((m.group('func'), m.group('file'), int_or_nul(m.group('row')), int_or_nul(m.group('col'))))
                continue

            m = JSError.RE_FUNC.match(line)

            if m:
                stack.append((m.group('func'), m.group('file'), None, None))
                continue

            m = JSError.RE_FILE.match(line)

            if m:
                stack.append((None, m.group('file'), int_or_nul(m.group('row')), int_or_nul(m.group('col'))))
                continue

            assert line

        return stack

    @property
    def frames(self):
        return self.parse_stack(self.stackTrace)

_PyV8._JSError._jsclass = JSError

JSObject = _PyV8.JSObject
JSArray = _PyV8.JSArray
JSFunction = _PyV8.JSFunction
JSExtension = _PyV8.JSExtension

def func_apply(self, thisArg, argArray=[]):
    if isinstance(thisArg, JSObject):
        return self.invoke(thisArg, argArray)

    this = JSContext.current.eval("(%s)" % json.dumps(thisArg))

    return self.invoke(this, argArray)

JSFunction.apply = func_apply

class JSLocker(_PyV8.JSLocker):
    def __enter__(self):
        self.enter()

        if JSContext.entered:
            self.leave()
            raise RuntimeError("Lock should be acquired before enter the context")

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if JSContext.entered:
            self.leave()
            raise RuntimeError("Lock should be released after leave the context")

        self.leave()

    def __nonzero__(self):
        return self.entered()

class JSUnlocker(_PyV8.JSUnlocker):
    def __enter__(self):
        self.enter()

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.leave()

    def __nonzero__(self):
        return self.entered()

class JSClass(object):
    __properties__ = {}
    __watchpoints__ = {}

    def __getattr__(self, name):
        if name == 'constructor':
            return JSClassConstructor(self.__class__)

        if name == 'prototype':
            return JSClassPrototype(self.__class__)

        prop = self.__dict__.setdefault('__properties__', {}).get(name, None)

        if prop and callable(prop[0]):
            return prop[0]()

        raise AttributeError(name)

    def __setattr__(self, name, value):
        prop = self.__dict__.setdefault('__properties__', {}).get(name, None)

        if prop and callable(prop[1]):
            return prop[1](value)

        return object.__setattr__(self, name, value)

    def toString(self):
        "Returns a string representation of an object."
        return "[object %s]" % self.__class__.__name__

    def toLocaleString(self):
        "Returns a value as a string value appropriate to the host environment's current locale."
        return self.toString()

    def valueOf(self):
        "Returns the primitive value of the specified object."
        return self

    def hasOwnProperty(self, name):
        "Returns a Boolean value indicating whether an object has a property with the specified name."
        return hasattr(self, name)

    def isPrototypeOf(self, obj):
        "Returns a Boolean value indicating whether an object exists in the prototype chain of another object."
        raise NotImplementedError()

    def __defineGetter__(self, name, getter):
        "Binds an object's property to a function to be called when that property is looked up."
        self.__properties__[name] = (getter, self.__lookupSetter__(name))

    def __lookupGetter__(self, name):
        "Return the function bound as a getter to the specified property."
        return self.__properties__.get(name, (None, None))[0]

    def __defineSetter__(self, name, setter):
        "Binds an object's property to a function to be called when an attempt is made to set that property."
        self.__properties__[name] = (self.__lookupGetter__(name), setter)

    def __lookupSetter__(self, name):
        "Return the function bound as a setter to the specified property."
        return self.__properties__.get(name, (None, None))[1]

    def watch(self, prop, handler):
        "Watches for a property to be assigned a value and runs a function when that occurs."
        self.__watchpoints__[prop] = handler

    def unwatch(self, prop):
        "Removes a watchpoint set with the watch method."
        del self.__watchpoints__[prop]

class JSClassConstructor(JSClass):
    def __init__(self, cls):
        self.cls = cls

    @property
    def name(self):
        return self.cls.__name__

    def toString(self):
        return "function %s() {\n  [native code]\n}" % self.name

    def __call__(self, *args, **kwds):
        return self.cls(*args, **kwds)

class JSClassPrototype(JSClass):
    def __init__(self, cls):
        self.cls = cls

    @property
    def constructor(self):
        return JSClassConstructor(self.cls)

    @property
    def name(self):
        return self.cls.__name__

class JSDebugProtocol(object):
    """
    Support the V8 debugger JSON based protocol.

    <http://code.google.com/p/v8/wiki/DebuggerProtocol>
    """
    class Packet(object):
        REQUEST = 'request'
        RESPONSE = 'response'
        EVENT = 'event'

        def __init__(self, payload):
            self.data = json.loads(payload) if type(payload) in [str, unicode] else payload

        @property
        def seq(self):
            return self.data['seq']

        @property
        def type(self):
            return self.data['type']

    class Request(Packet):
        @property
        def cmd(self):
            return self.data['command']

        @property
        def args(self):
            return self.data['args']

    class Response(Packet):
        @property
        def request_seq(self):
            return self.data['request_seq']

        @property
        def cmd(self):
            return self.data['command']

        @property
        def body(self):
            return self.data['body']

        @property
        def running(self):
            return self.data['running']

        @property
        def success(self):
            return self.data['success']

        @property
        def message(self):
            return self.data['message']

    class Event(Packet):
        @property
        def event(self):
            return self.data['event']

        @property
        def body(self):
            return self.data['body']

    def __init__(self):
        self.seq = 0

    def nextSeq(self):
        seq = self.seq
        self.seq += 1

        return seq

    def parsePacket(self, payload):
        obj = json.loads(payload)

        return JSDebugProtocol.Event(obj) if obj['type'] == 'event' else JSDebugProtocol.Response(obj)
    
class JSDebugEvent(_PyV8.JSDebugEvent):
    class FrameData(object):
        def __init__(self, frame, count, name, value):
            self.frame = frame
            self.count = count
            self.name = name
            self.value = value

        def __len__(self):
            return self.count(self.frame)

        def __iter__(self):
            for i in xrange(self.count(self.frame)):
                yield (self.name(self.frame, i), self.value(self.frame, i))

    class Frame(object):
        def __init__(self, frame):
            self.frame = frame

        @property
        def index(self):
            return int(self.frame.index())

        @property
        def function(self):
            return self.frame.func()

        @property
        def receiver(self):
            return self.frame.receiver()

        @property
        def isConstructCall(self):
            return bool(self.frame.isConstructCall())

        @property
        def isDebuggerFrame(self):
            return bool(self.frame.isDebuggerFrame())

        @property
        def argumentCount(self):
            return int(self.frame.argumentCount())

        def argumentName(self, idx):
            return str(self.frame.argumentName(idx))

        def argumentValue(self, idx):
            return self.frame.argumentValue(idx)

        @property
        def arguments(self):
            return FrameData(self, self.argumentCount, self.argumentName, self.argumentValue)

        def localCount(self, idx):
            return int(self.frame.localCount())

        def localName(self, idx):
            return str(self.frame.localName(idx))

        def localValue(self, idx):
            return self.frame.localValue(idx)

        @property
        def locals(self):
            return FrameData(self, self.localCount, self.localName, self.localValue)

        @property
        def sourcePosition(self):
            return self.frame.sourcePosition()

        @property
        def sourceLine(self):
            return int(self.frame.sourceLine())

        @property
        def sourceColumn(self):
            return int(self.frame.sourceColumn())

        @property
        def sourceLineText(self):
            return str(self.frame.sourceLineText())

        def evaluate(self, source, disable_break = True):
            return self.frame.evaluate(source, disable_break)

        @property
        def invocationText(self):
            return str(self.frame.invocationText())

        @property
        def sourceAndPositionText(self):
            return str(self.frame.sourceAndPositionText())

        @property
        def localsText(self):
            return str(self.frame.localsText())

        def __str__(self):
            return str(self.frame.toText())

    class Frames(object):
        def __init__(self, state):
            self.state = state

        def __len__(self):
            return self.state.frameCount

        def __iter__(self):
            for i in xrange(self.state.frameCount):
                yield self.state.frame(i)

    class State(object):
        def __init__(self, state):
            self.state = state

        @property
        def frameCount(self):
            return int(self.state.frameCount())

        def frame(self, idx = None):
            return JSDebugEvent.Frame(self.state.frame(idx))

        @property
        def selectedFrame(self):
            return int(self.state.selectedFrame())

        @property
        def frames(self):
            return JSDebugEvent.Frames(self)

        def __repr__(self):
            s = StringIO()

            try:
                for frame in self.frames:
                    s.write(str(frame))

                return s.getvalue()
            finally:
                s.close()

    class DebugEvent(object):
        pass

    class StateEvent(DebugEvent):
        __state = None

        @property
        def state(self):
            if not self.__state:
                self.__state = JSDebugEvent.State(self.event.executionState())

            return self.__state

    class BreakEvent(StateEvent):
        type = _PyV8.JSDebugEvent.Break

        def __init__(self, event):
            self.event = event

    class ExceptionEvent(StateEvent):
        type = _PyV8.JSDebugEvent.Exception

        def __init__(self, event):
            self.event = event

    class NewFunctionEvent(DebugEvent):
        type = _PyV8.JSDebugEvent.NewFunction

        def __init__(self, event):
            self.event = event

    class Script(object):
        def __init__(self, script):
            self.script = script

        @property
        def source(self):
            return self.script.source()

        @property
        def id(self):
            return self.script.id()

        @property
        def name(self):
            return self.script.name()

        @property
        def lineOffset(self):
            return self.script.lineOffset()

        @property
        def lineCount(self):
            return self.script.lineCount()

        @property
        def columnOffset(self):
            return self.script.columnOffset()

        @property
        def type(self):
            return self.script.type()

        def __repr__(self):
            return "<%s script %s @ %d:%d> : '%s'" % (self.type, self.name,
                                                      self.lineOffset, self.columnOffset,
                                                      self.source)

    class CompileEvent(StateEvent):
        def __init__(self, event):
            self.event = event

        @property
        def script(self):
            if not hasattr(self, "_script"):
                setattr(self, "_script", JSDebugEvent.Script(self.event.script()))

            return self._script

        def __str__(self):
            return str(self.script)

    class BeforeCompileEvent(CompileEvent):
        type = _PyV8.JSDebugEvent.BeforeCompile

        def __init__(self, event):
            JSDebugEvent.CompileEvent.__init__(self, event)

        def __repr__(self):
            return "before compile script: %s\n%s" % (repr(self.script), repr(self.state))

    class AfterCompileEvent(CompileEvent):
        type = _PyV8.JSDebugEvent.AfterCompile

        def __init__(self, event):
            JSDebugEvent.CompileEvent.__init__(self, event)

        def __repr__(self):
            return "after compile script: %s\n%s" % (repr(self.script), repr(self.state))

    onMessage = None
    onBreak = None
    onException = None
    onNewFunction = None
    onBeforeCompile = None
    onAfterCompile = None

class JSDebugger(JSDebugProtocol, JSDebugEvent):
    def __init__(self):
        JSDebugProtocol.__init__(self)
        JSDebugEvent.__init__(self)

    def __enter__(self):
        self.enabled = True

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.enabled = False

    @property
    def context(self):
        if not hasattr(self, '_context'):
            self._context = JSContext(ctxt=_PyV8.debug().context)

        return self._context

    def isEnabled(self):
        return _PyV8.debug().enabled

    def setEnabled(self, enable):
        dbg = _PyV8.debug()

        if enable:
            dbg.onDebugEvent = self.onDebugEvent
            dbg.onDebugMessage = self.onDebugMessage
            dbg.onDispatchDebugMessages = self.onDispatchDebugMessages
        else:
            dbg.onDebugEvent = None
            dbg.onDebugMessage = None
            dbg.onDispatchDebugMessages = None

        dbg.enabled = enable

    enabled = property(isEnabled, setEnabled)

    def onDebugMessage(self, msg, data):
        if self.onMessage:
            self.onMessage(json.loads(msg))

    def onDebugEvent(self, type, state, evt):
        if type == JSDebugEvent.Break:
            if self.onBreak: self.onBreak(JSDebugEvent.BreakEvent(evt))
        elif type == JSDebugEvent.Exception:
            if self.onException: self.onException(JSDebugEvent.ExceptionEvent(evt))
        elif type == JSDebugEvent.NewFunction:
            if self.onNewFunction: self.onNewFunction(JSDebugEvent.NewFunctionEvent(evt))
        elif type == JSDebugEvent.BeforeCompile:
            if self.onBeforeCompile: self.onBeforeCompile(JSDebugEvent.BeforeCompileEvent(evt))
        elif type == JSDebugEvent.AfterCompile:
            if self.onAfterCompile: self.onAfterCompile(JSDebugEvent.AfterCompileEvent(evt))

    def onDispatchDebugMessages(self):
        return True

    def debugBreak(self):
        _PyV8.debug().debugBreak()

    def debugBreakForCommand(self):
        _PyV8.debug().debugBreakForCommand()

    def cancelDebugBreak(self):
        _PyV8.debug().cancelDebugBreak()

    def processDebugMessages(self):
        _PyV8.debug().processDebugMessages()

    def sendCommand(self, cmd, *args, **kwds):
        request = json.dumps({
            'seq': self.nextSeq(),
            'type': 'request',
            'command': cmd,
            'arguments': kwds
        })

        _PyV8.debug().sendCommand(request)

        return request

    def debugContinue(self, action='next', steps=1):
        return self.sendCommand('continue', stepaction=action)

    def stepNext(self, steps=1):
        """Step to the next statement in the current function."""
        return self.debugContinue(action='next', steps=steps)

    def stepIn(self, steps=1):
        """Step into new functions invoked or the next statement in the current function."""
        return self.debugContinue(action='in', steps=steps)

    def stepOut(self, steps=1):
        """Step out of the current function."""
        return self.debugContinue(action='out', steps=steps)

    def stepMin(self, steps=1):
        """Perform a minimum step in the current function."""
        return self.debugContinue(action='out', steps=steps)

class JSProfiler(_PyV8.JSProfiler):
    @property
    def logs(self):
        pos = 0

        while True:
            size, buf = self.getLogLines(pos)

            if size == 0:
                break

            for line in buf.split('\n'):
                yield line

            pos += size

profiler = JSProfiler()

JSObjectSpace = _PyV8.JSObjectSpace
JSAllocationAction = _PyV8.JSAllocationAction

class JSEngine(_PyV8.JSEngine):
    def __init__(self):
        _PyV8.JSEngine.__init__(self)
        
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        del self

JSScript = _PyV8.JSScript

JSStackTrace = _PyV8.JSStackTrace
JSStackTrace.Options = _PyV8.JSStackTraceOptions
JSStackFrame = _PyV8.JSStackFrame

class JSIsolate(_PyV8.JSIsolate):
    def __enter__(self):
        self.enter()

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.leave()

        del self

class JSContext(_PyV8.JSContext):
    def __init__(self, obj=None, extensions=None, ctxt=None):
        if JSLocker.active:
            self.lock = JSLocker()
            self.lock.enter()

        if ctxt:
            _PyV8.JSContext.__init__(self, ctxt)
        else:
            _PyV8.JSContext.__init__(self, obj, extensions or [])

    def __enter__(self):
        self.enter()

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.leave()

        if hasattr(JSLocker, 'lock'):
            self.lock.leave()
            self.lock = None

        del self

# contribute by marc boeker <http://code.google.com/u/marc.boeker/>
def convert(obj):
    if type(obj) == _PyV8.JSArray:
        return [convert(v) for v in obj]

    if type(obj) == _PyV8.JSObject:
        return dict([[str(k), convert(obj.__getattr__(str(k)))] for k in obj.__members__])

    return obj

class AST:
    Scope = _PyV8.AstScope
    VarMode = _PyV8.AstVariableMode
    Var = _PyV8.AstVariable
    Label = _PyV8.AstLabel
    NodeType = _PyV8.AstNodeType
    Node = _PyV8.AstNode
    Statement = _PyV8.AstStatement
    Expression = _PyV8.AstExpression
    Breakable = _PyV8.AstBreakableStatement
    Block = _PyV8.AstBlock
    Declaration = _PyV8.AstDeclaration
    Iteration = _PyV8.AstIterationStatement
    DoWhile = _PyV8.AstDoWhileStatement
    While = _PyV8.AstWhileStatement
    For = _PyV8.AstForStatement
    ForIn = _PyV8.AstForInStatement
    ExpressionStatement = _PyV8.AstExpressionStatement
    Continue = _PyV8.AstContinueStatement
    Break = _PyV8.AstBreakStatement
    Return = _PyV8.AstReturnStatement
    With = _PyV8.AstWithStatement
    Case = _PyV8.AstCaseClause
    Switch = _PyV8.AstSwitchStatement
    Try = _PyV8.AstTryStatement
    TryCatch = _PyV8.AstTryCatchStatement
    TryFinally = _PyV8.AstTryFinallyStatement
    Debugger = _PyV8.AstDebuggerStatement
    Empty = _PyV8.AstEmptyStatement
    Literal = _PyV8.AstLiteral
    MaterializedLiteral = _PyV8.AstMaterializedLiteral
    PropertyKind = _PyV8.AstPropertyKind
    ObjectProperty = _PyV8.AstObjectProperty
    Object = _PyV8.AstObjectLiteral
    RegExp = _PyV8.AstRegExpLiteral
    Array = _PyV8.AstArrayLiteral
    VarProxy = _PyV8.AstVariableProxy
    Property = _PyV8.AstProperty
    Call = _PyV8.AstCall
    CallNew = _PyV8.AstCallNew
    CallRuntime = _PyV8.AstCallRuntime
    Op = _PyV8.AstOperation
    UnaryOp = _PyV8.AstUnaryOperation
    BinOp = _PyV8.AstBinaryOperation
    CountOp = _PyV8.AstCountOperation
    CompOp = _PyV8.AstCompareOperation
    Conditional = _PyV8.AstConditional
    Assignment = _PyV8.AstAssignment
    Throw = _PyV8.AstThrow
    Function = _PyV8.AstFunctionLiteral
    SharedFunction = _PyV8.AstSharedFunctionInfoLiteral
    This = _PyV8.AstThisFunction

from datetime import *
import unittest
import logging
import traceback

class TestContext(unittest.TestCase):
    def testMultiNamespace(self):
        self.assert_(not bool(JSContext.inContext))
        self.assert_(not bool(JSContext.entered))

        class Global(object):
            name = "global"

        g = Global()

        with JSContext(g) as ctxt:
            self.assert_(bool(JSContext.inContext))
            self.assertEquals(g.name, str(JSContext.entered.locals.name))
            self.assertEquals(g.name, str(JSContext.current.locals.name))

            class Local(object):
                name = "local"

            l = Local()

            with JSContext(l):
                self.assert_(bool(JSContext.inContext))
                self.assertEquals(l.name, str(JSContext.entered.locals.name))
                self.assertEquals(l.name, str(JSContext.current.locals.name))

            self.assert_(bool(JSContext.inContext))
            self.assertEquals(g.name, str(JSContext.entered.locals.name))
            self.assertEquals(g.name, str(JSContext.current.locals.name))

        self.assert_(not bool(JSContext.entered))
        self.assert_(not bool(JSContext.inContext))

    def _testMultiContext(self):
        # Create an environment
        with JSContext() as ctxt0:
            ctxt0.securityToken = "password"

            global0 = ctxt0.locals
            global0.custom = 1234

            self.assertEquals(1234, int(global0.custom))

            # Create an independent environment
            with JSContext() as ctxt1:
                ctxt1.securityToken = ctxt0.securityToken

                global1 = ctxt1.locals
                global1.custom = 1234

                with ctxt0:
                    self.assertEquals(1234, int(global0.custom))
                self.assertEquals(1234, int(global1.custom))

                # Now create a new context with the old global
                with JSContext(global1) as ctxt2:
                    ctxt2.securityToken = ctxt1.securityToken

                    with ctxt1:
                        self.assertEquals(1234, int(global1.custom))
                        
                    self.assertEquals(1234, int(global2.custom))

    def _testSecurityChecks(self):
        with JSContext() as env1:
            env1.securityToken = "foo"

            # Create a function in env1.
            env1.eval("spy=function(){return spy;}")

            spy = env1.locals.spy

            self.assert_(isinstance(spy, _PyV8.JSFunction))

            # Create another function accessing global objects.
            env1.eval("spy2=function(){return 123;}")

            spy2 = env1.locals.spy2

            self.assert_(isinstance(spy2, _PyV8.JSFunction))

            # Switch to env2 in the same domain and invoke spy on env2.
            env2 = JSContext()

            env2.securityToken = "foo"

            with env2:
                result = spy.apply(env2.locals)

                self.assert_(isinstance(result, _PyV8.JSFunction))

            env2.securityToken = "bar"

            # Call cross_domain_call, it should throw an exception
            with env2:
                self.assertRaises(JSError, spy2.apply, env2.locals)

    def _testCrossDomainDelete(self):
        with JSContext() as env1:
            env2 = JSContext()

            # Set to the same domain.
            env1.securityToken = "foo"
            env2.securityToken = "foo"

            env1.locals.prop = 3

            env2.locals.env1 = env1.locals

            # Change env2 to a different domain and delete env1.prop.
            #env2.securityToken = "bar"

            self.assertEquals(3, int(env1.eval("prop")))

            print env1.eval("env1")

            with env2:
                self.assertEquals(3, int(env2.eval("this.env1.prop")))
                self.assertEquals("false", str(e.eval("delete env1.prop")))

            # Check that env1.prop still exists.
            self.assertEquals(3, int(env1.locals.prop))

class TestWrapper(unittest.TestCase):
    def testObject(self):
        with JSContext() as ctxt:
            o = ctxt.eval("new Object()")

            self.assert_(hash(o) > 0)

            o1 = o.clone()

            self.assertEquals(hash(o1), hash(o))
            self.assert_(o != o1)

    def testAutoConverter(self):
        with JSContext() as ctxt:
            ctxt.eval("""
                var_i = 1;
                var_f = 1.0;
                var_s = "test";
                var_b = true;
                var_s_obj = new String("test");
                var_b_obj = new Boolean(true);
                var_f_obj = new Number(1.5);
            """)

            vars = ctxt.locals

            var_i = vars.var_i

            self.assert_(var_i)
            self.assertEquals(1, int(var_i))

            var_f = vars.var_f

            self.assert_(var_f)
            self.assertEquals(1.0, float(vars.var_f))

            var_s = vars.var_s
            self.assert_(var_s)
            self.assertEquals("test", str(vars.var_s))

            var_b = vars.var_b
            self.assert_(var_b)
            self.assert_(bool(var_b))

            self.assertEquals("test", vars.var_s_obj)
            self.assert_(vars.var_b_obj)
            self.assertEquals(1.5, vars.var_f_obj)

            attrs = dir(ctxt.locals)

            self.assert_(attrs)
            self.assert_("var_i" in attrs)
            self.assert_("var_f" in attrs)
            self.assert_("var_s" in attrs)
            self.assert_("var_b" in attrs)
            self.assert_("var_s_obj" in attrs)
            self.assert_("var_b_obj" in attrs)
            self.assert_("var_f_obj" in attrs)

    def testExactConverter(self):
        class MyInteger(int, JSClass):
            pass

        class MyString(str, JSClass):
            pass

        class MyUnicode(unicode, JSClass):
            pass

        class MyDateTime(time, JSClass):
            pass

        class Global(JSClass):
            var_bool = True
            var_int = 1
            var_float = 1.0
            var_str = 'str'
            var_unicode = u'unicode'
            var_datetime = datetime.now()
            var_date = date.today()
            var_time = time()

            var_myint = MyInteger()
            var_mystr = MyString('mystr')
            var_myunicode = MyUnicode('myunicode')
            var_mytime = MyDateTime()

        with JSContext(Global()) as ctxt:
            typename = ctxt.eval("(function (name) { return this[name].constructor.name; })")
            typeof = ctxt.eval("(function (name) { return typeof(this[name]); })")

            self.assertEquals('Boolean', typename('var_bool'))
            self.assertEquals('Number', typename('var_int'))
            self.assertEquals('Number', typename('var_float'))
            self.assertEquals('String', typename('var_str'))
            self.assertEquals('String', typename('var_unicode'))
            self.assertEquals('Date', typename('var_datetime'))
            self.assertEquals('Date', typename('var_date'))
            self.assertEquals('Date', typename('var_time'))

            self.assertEquals('MyInteger', typename('var_myint'))
            self.assertEquals('MyString', typename('var_mystr'))
            self.assertEquals('MyUnicode', typename('var_myunicode'))
            self.assertEquals('MyDateTime', typename('var_mytime'))

            self.assertEquals('object', typeof('var_myint'))
            self.assertEquals('object', typeof('var_mystr'))
            self.assertEquals('object', typeof('var_myunicode'))
            self.assertEquals('object', typeof('var_mytime'))

    def testJavascriptWrapper(self):
        with JSContext() as ctxt:
            self.assertEquals(type(None), type(ctxt.eval("null")))
            self.assertEquals(type(None), type(ctxt.eval("undefined")))
            self.assertEquals(bool, type(ctxt.eval("true")))
            self.assertEquals(str, type(ctxt.eval("'test'")))
            self.assertEquals(int, type(ctxt.eval("123")))
            self.assertEquals(float, type(ctxt.eval("3.14")))
            self.assertEquals(datetime, type(ctxt.eval("new Date()")))
            self.assertEquals(JSArray, type(ctxt.eval("[1, 2, 3]")))
            self.assertEquals(JSFunction, type(ctxt.eval("(function() {})")))
            self.assertEquals(JSObject, type(ctxt.eval("new Object()")))

    def testPythonWrapper(self):
        with JSContext() as ctxt:
            typeof = ctxt.eval("(function type(value) { return typeof value; })")
            protoof = ctxt.eval("(function protoof(value) { return Object.prototype.toString.apply(value); })")

            self.assertEquals('[object Null]', protoof(None))
            self.assertEquals('boolean', typeof(True))
            self.assertEquals('number', typeof(123))
            self.assertEquals('number', typeof(123l))
            self.assertEquals('number', typeof(3.14))
            self.assertEquals('string', typeof('test'))
            self.assertEquals('string', typeof(u'test'))

            self.assertEquals('[object Date]', protoof(datetime.now()))
            self.assertEquals('[object Date]', protoof(date.today()))
            self.assertEquals('[object Date]', protoof(time()))

            def test():
                pass

            self.assertEquals('[object Function]', protoof(abs))
            self.assertEquals('[object Function]', protoof(test))
            self.assertEquals('[object Function]', protoof(self.testPythonWrapper))
            self.assertEquals('[object Function]', protoof(int))

    def testFunction(self):
        with JSContext() as ctxt:
            func = ctxt.eval("""
                (function ()
                {
                    function a()
                    {
                        return "abc";
                    }

                    return a();
                })
                """)

            self.assertEquals("abc", str(func()))
            self.assert_(func != None)
            self.assertFalse(func == None)

            func = ctxt.eval("(function test() {})")

            self.assertEquals("test", func.name)
            self.assertEquals("", func.resname)
            self.assertEquals(0, func.linenum)
            self.assertEquals(14, func.colnum)
            self.assertEquals(0, func.lineoff)
            self.assertEquals(0, func.coloff)
            
            #TODO fix me, why the setter doesn't work?

            func.name = "hello"

            #self.assertEquals("hello", func.name)

    def testCall(self):
        class Hello(object):
            def __call__(self, name):
                return "hello " + name

        class Global(JSClass):
            hello = Hello()

        with JSContext(Global()) as ctxt:
            self.assertEquals("hello flier", ctxt.eval("hello('flier')"))

    def testJSFunction(self):
        with JSContext() as ctxt:
            hello = ctxt.eval("(function (name) { return 'hello ' + name; })")

            self.assert_(isinstance(hello, _PyV8.JSFunction))
            self.assertEquals("hello flier", hello('flier'))
            self.assertEquals("hello flier", hello.invoke(['flier']))

            obj = ctxt.eval("({ 'name': 'flier', 'hello': function (name) { return 'hello ' + name + ' from ' + this.name; }})")
            hello = obj.hello
            self.assert_(isinstance(hello, JSFunction))
            self.assertEquals("hello flier from flier", hello('flier'))

            tester = ctxt.eval("({ 'name': 'tester' })")
            self.assertEquals("hello flier from tester", hello.invoke(tester, ['flier']))
            self.assertEquals("hello flier from json", hello.apply({ 'name': 'json' }, ['flier']))

    def testJSError(self):
        with JSContext() as ctxt:
            try:
                ctxt.eval('throw "test"')
                self.fail()
            except:
                self.assert_(JSError, sys.exc_type)

    def testErrorInfo(self):
        with JSContext() as ctxt:
            with JSEngine() as engine:
                try:
                    engine.compile("""
                        function hello()
                        {
                            throw Error("hello world");
                        }

                        hello();""", "test", 10, 10).run()
                    self.fail()
                except JSError, e:
                    self.assert_(str(e).startswith('JSError: Error: hello world ( test @ 14 : 34 )  ->'))
                    self.assertEqual("Error", e.name)
                    self.assertEqual("hello world", e.message)
                    self.assertEqual("test", e.scriptName)
                    self.assertEqual(14, e.lineNum)
                    self.assertEqual(102, e.startPos)
                    self.assertEqual(103, e.endPos)
                    self.assertEqual(34, e.startCol)
                    self.assertEqual(35, e.endCol)
                    self.assertEqual('throw Error("hello world");', e.sourceLine.strip())
                    self.assertEqual('Error: hello world\n' +
                                     '    at Error (unknown source)\n' +
                                     '    at hello (test:14:35)\n' +
                                     '    at test:17:25', e.stackTrace)

    def testParseStack(self):
        self.assertEquals([
            ('Error', 'unknown source', None, None),
            ('test', 'native', None, None),
            ('<anonymous>', 'test0', 3, 5),
            ('f', 'test1', 2, 19),
            ('g', 'test2', 1, 15),
            (None, 'test3', 1, None),
            (None, 'test3', 1, 1),
        ], JSError.parse_stack("""Error: err
            at Error (unknown source)
            at test (native)
            at new <anonymous> (test0:3:5)
            at f (test1:2:19)
            at g (test2:1:15)
            at test3:1
            at test3:1:1"""))

    def testStackTrace(self):
        class Global(JSClass):
            def GetCurrentStackTrace(self, limit):
                return JSStackTrace.GetCurrentStackTrace(4, JSStackTrace.Options.Detailed)

        with JSContext(Global()) as ctxt:
            st = ctxt.eval("""
                function a()
                {
                    return GetCurrentStackTrace(10);
                }
                function b()
                {
                    return eval("a()");
                }
                function c()
                {
                    return new b();
                }
            c();""", "test")

            self.assertEquals(4, len(st))
            self.assertEquals("\tat a (test:4:28)\n\tat (eval)\n\tat b (test:8:28)\n\tat c (test:12:28)\n", str(st))
            self.assertEquals("test.a (4:28)\n. (1:1) eval\ntest.b (8:28) constructor\ntest.c (12:28)",
                              "\n".join(["%s.%s (%d:%d)%s%s" % (
                                f.scriptName, f.funcName, f.lineNum, f.column,
                                ' eval' if f.isEval else '',
                                ' constructor' if f.isConstructor else '') for f in st]))

    def testPythonException(self):
        class Global(JSClass):
            def raiseException(self):
                raise RuntimeError("Hello")

        with JSContext(Global()) as ctxt:
            r = ctxt.eval("""
                msg ="";
                try
                {
                    this.raiseException()
                }
                catch(e)
                {
                    msg += "catch " + e + ";";
                }
                finally
                {
                    msg += "finally";
                }""")
            self.assertEqual("catch Error: Hello;finally", str(ctxt.locals.msg))

    def testExceptionMapping(self):
        class TestException(Exception):
            pass

        class Global(JSClass):
            def raiseIndexError(self):
                return [1, 2, 3][5]

            def raiseAttributeError(self):
                None.hello()

            def raiseSyntaxError(self):
                eval("???")

            def raiseTypeError(self):
                int(sys)

            def raiseNotImplementedError(self):
                raise NotImplementedError("Not support")

            def raiseExceptions(self):
                raise TestException()

        with JSContext(Global()) as ctxt:
            ctxt.eval("try { this.raiseIndexError(); } catch (e) { msg = e; }")

            self.assertEqual("RangeError: list index out of range", str(ctxt.locals.msg))

            ctxt.eval("try { this.raiseAttributeError(); } catch (e) { msg = e; }")

            self.assertEqual("ReferenceError: 'NoneType' object has no attribute 'hello'", str(ctxt.locals.msg))

            ctxt.eval("try { this.raiseSyntaxError(); } catch (e) { msg = e; }")

            self.assertEqual("SyntaxError: invalid syntax", str(ctxt.locals.msg))

            ctxt.eval("try { this.raiseTypeError(); } catch (e) { msg = e; }")

            self.assertEqual("TypeError: int() argument must be a string or a number, not 'module'", str(ctxt.locals.msg))

            ctxt.eval("try { this.raiseNotImplementedError(); } catch (e) { msg = e; }")

            self.assertEqual("Error: Not support", str(ctxt.locals.msg))

            self.assertRaises(TestException, ctxt.eval, "this.raiseExceptions();")

    def testArray(self):
        with JSContext() as ctxt:
            array = ctxt.eval("""
                var array = new Array();

                for (i=0; i<10; i++)
                {
                    array[i] = 10-i;
                }

                array;
                """)

            self.assert_(isinstance(array, _PyV8.JSArray))
            self.assertEqual(10, len(array))

            self.assert_(5 in array)
            self.assertFalse(15 in array)

            l = list(array)

            self.assertEqual(10, len(l))

            for i in xrange(10):
                self.assertEqual(10-i, array[i])
                self.assertEqual(10-i, l[i])

            array[5] = 0

            self.assertEqual(0, array[5])

            del array[5]

            self.assertEquals(None, array[5])

            ctxt.locals.array1 = JSArray(5)
            ctxt.locals.array2 = JSArray([1, 2, 3, 4, 5])

            for i in xrange(len(ctxt.locals.array2)):
                ctxt.locals.array1[i] = ctxt.locals.array2[i] * 10

            ctxt.eval("""
                var sum = 0;

                for (i=0; i<array1.length; i++)
                    sum += array1[i]

                for (i=0; i<array2.length; i++)
                    sum += array2[i]
                """)

            self.assertEqual(165, ctxt.locals.sum)

            ctxt.locals.array3 = [1, 2, 3, 4, 5]
            self.assert_(ctxt.eval('array3[1] === 2'))
            self.assert_(ctxt.eval('array3[9] === undefined'))

            cases = {
                "a = Array(7); for(i=0; i<a.length; i++) a[i] = i; a[3] = undefined; a[a.length-1]; a" : ("0,1,2,,4,5,6", [0, 1, 2, None, 4, 5, 6]),
                "a = Array(7); for(i=0; i<a.length - 1; i++) a[i] = i; a[a.length-1]; a" : ("0,1,2,3,4,5,", [0, 1, 2, 3, 4, 5, None]),
                "a = Array(7); for(i=1; i<a.length; i++) a[i] = i; a[a.length-1]; a" : (",1,2,3,4,5,6", [None, 1, 2, 3, 4, 5, 6])
            }

            for code, (keys, values) in cases.items():
                array = ctxt.eval(code)

                self.assertEquals(keys, str(array))
                self.assertEquals(values, [array[i] for i in range(len(array))])

    def testMultiDimArray(self):
        with JSContext() as ctxt:
            ret = ctxt.eval("""
                ({
                    'test': function(){
                        return  [
                            [ 1, 'abla' ],
                            [ 2, 'ajkss' ],
                        ]
                    }
                })
                """).test()

            self.assertEquals([[1, 'abla'], [2, 'ajkss']], convert(ret))

    def testLazyConstructor(self):
        class Globals(JSClass):
            def __init__(self):
                self.array=JSArray([1,2,3])

        with JSContext(Globals()) as ctxt:
            self.assertEqual(2, ctxt.eval("""array[1]"""))

    def testForEach(self):
        class NamedClass(object):
            foo = 1

            def __init__(self):
                self.bar = 2

            @property
            def foobar(self):
                return self.foo + self.bar

        def gen(x):
            for i in range(x):
                yield i

        with JSContext() as ctxt:
            func = ctxt.eval("""(function (k) {
                var result = [];
                for (var prop in k) {
                  result.push(prop);
                }
                return result;
            })""")

            self.assertEquals(["bar", "foo", "foobar"], list(func(NamedClass())))
            self.assertEquals(["0", "1", "2"], list(func([1, 2, 3])))
            self.assertEquals(["0", "1", "2"], list(func((1, 2, 3))))
            self.assertEquals(["1", "2", "3"], list(func({1:1, 2:2, 3:3})))

            self.assertEquals(["0", "1", "2"], list(func(gen(3))))

    def testDict(self):
        import UserDict

        with JSContext() as ctxt:
            obj = ctxt.eval("var r = { 'a' : 1, 'b' : 2 }; r")

            self.assertEqual(1, obj.a)
            self.assertEqual(2, obj.b)

            self.assertEqual({ 'a' : 1, 'b' : 2 }, dict(obj))

            self.assertEqual({ 'a': 1,
                               'b': [1, 2, 3],
                               'c': { 'str' : 'goofy',
                                      'float' : 1.234,
                                      'obj' : { 'name': 'john doe' }},
                               'd': True,
                               'e': None },
                             convert(ctxt.eval("""var x =
                             { a: 1,
                               b: [1, 2, 3],
                               c: { str: 'goofy',
                                    float: 1.234,
                                    obj: { name: 'john doe' }},
                               d: true,
                               e: null }; x""")))

    def testDate(self):
        with JSContext() as ctxt:
            now1 = ctxt.eval("new Date();")

            self.assert_(now1)

            now2 = datetime.utcnow()

            delta = now2 - now1 if now2 > now1 else now1 - now2

            self.assert_(delta < timedelta(seconds=1))

            func = ctxt.eval("(function (d) { return d.toString(); })")

            now = datetime.now()

            self.assert_(str(func(now)).startswith(now.strftime("%a %b %d %Y %H:%M:%S")))

    def testUnicode(self):
        with JSContext() as ctxt:
            self.assertEquals(u"人", unicode(ctxt.eval(u"\"人\""), "utf-8"))
            self.assertEquals(u"é", unicode(ctxt.eval(u"\"é\""), "utf-8"))

            func = ctxt.eval("(function (msg) { return msg.length; })")

            self.assertEquals(2, func(u"测试"))

    def testClassicStyleObject(self):
        class FileSystemWarpper:
            @property
            def cwd(self):
                return os.getcwd()

        class Global:
            @property
            def fs(self):
                return FileSystemWarpper()

        with JSContext(Global()) as ctxt:
            self.assertEquals(os.getcwd(), ctxt.eval("fs.cwd"))

    def testRefCount(self):
        count = sys.getrefcount(None)

        class Global(JSClass):
            pass

        with JSContext(Global()) as ctxt:
            ctxt.eval("""
                var none = null;
            """)

            self.assertEquals(count+1, sys.getrefcount(None))

            ctxt.eval("""
                var none = null;
            """)

            self.assertEquals(count+1, sys.getrefcount(None))

    def testProperty(self):
        class Global(JSClass):
            def __init__(self, name):
                self._name = name
            def getname(self):
                return self._name
            def setname(self, name):
                self._name = name
            def delname(self):
                self._name = 'deleted'

            name = property(getname, setname, delname)

        g = Global('world')

        with JSContext(g) as ctxt:
            self.assertEquals('world', ctxt.eval("name"))
            self.assertEquals('flier', ctxt.eval("this.name = 'flier';"))
            self.assertEquals('flier', ctxt.eval("name"))
            self.assert_(ctxt.eval("delete name"))
            ###
            # FIXME replace the global object with Python object
            #
            #self.assertEquals('deleted', ctxt.eval("name"))
            #ctxt.eval("__defineGetter__('name', function() { return 'fixed'; });")
            #self.assertEquals('fixed', ctxt.eval("name"))

    def testGetterAndSetter(self):
        class Global(JSClass):
           def __init__(self, testval):
               self.testval = testval

        with JSContext(Global("Test Value A")) as ctxt:
           self.assertEquals("Test Value A", ctxt.locals.testval)
           ctxt.eval("""
               this.__defineGetter__("test", function() {
                   return this.testval;
               });
               this.__defineSetter__("test", function(val) {
                   this.testval = val;
               });
           """)
           self.assertEquals("Test Value A",  ctxt.locals.test)

           ctxt.eval("test = 'Test Value B';")

           self.assertEquals("Test Value B",  ctxt.locals.test)

    def testDestructor(self):
        import gc

        owner = self
        owner.deleted = False

        class Hello(object):
            def say(self):
                pass

            def __del__(self):
                owner.deleted = True

        def test():
            with JSContext() as ctxt:
                fn = ctxt.eval("(function (obj) { obj.say(); })")

                obj = Hello()

                self.assert_(2, sys.getrefcount(obj))

                fn(obj)

                self.assert_(3, sys.getrefcount(obj))

                del obj

        test()

        self.assertFalse(owner.deleted)

        JSEngine.collect()
        gc.collect()

        self.assert_(self.deleted)

    def testNullInString(self):
        with JSContext() as ctxt:
            fn = ctxt.eval("(function (s) { return s; })")

            self.assertEquals("hello \0 world", fn("hello \0 world"))

    def testLivingObjectCache(self):
        class Global(JSClass):
            i = 1
            b = True
            o = object()

        with JSContext(Global()) as ctxt:
            self.assert_(ctxt.eval("i == i"))
            self.assert_(ctxt.eval("b == b"))
            self.assert_(ctxt.eval("o == o"))

    def testNamedSetter(self):
        class Obj(JSClass):
            @property
            def p(self):
                return self._p

            @p.setter
            def p(self, value):
                self._p = value

        class Global(JSClass):
            def __init__(self):
                self.obj = Obj()
                self.d = {}
                self.p = None

        with JSContext(Global()) as ctxt:
            ctxt.eval("""
            x = obj;
            x.y = 10;
            x.p = 10;
            d.y = 10;
            """)
            self.assertEquals(10, ctxt.eval("obj.y"))
            self.assertEquals(10, ctxt.eval("obj.p"))
            self.assertEquals(10, ctxt.locals.d['y'])

    def testWatch(self):
        class Obj(JSClass):
            def __init__(self):
                self.p = 1

        class Global(JSClass):
            def __init__(self):
                self.o = Obj()

        with JSContext(Global()) as ctxt:
            ctxt.eval("""
            o.watch("p", function (id, oldval, newval) {
                return oldval + newval;
            });
            """)

            self.assertEquals(1, ctxt.eval("o.p"))

            ctxt.eval("o.p = 2;")

            self.assertEquals(3, ctxt.eval("o.p"))

            ctxt.eval("delete o.p;")

            self.assertEquals(None, ctxt.eval("o.p"))

            ctxt.eval("o.p = 2;")

            self.assertEquals(2, ctxt.eval("o.p"))

            ctxt.eval("o.unwatch('p');")

            ctxt.eval("o.p = 1;")

            self.assertEquals(1, ctxt.eval("o.p"))

    def testReferenceError(self):
        class Global(JSClass):
            def __init__(self):
                self.s = self

        with JSContext(Global()) as ctxt:
            self.assertRaises(ReferenceError, ctxt.eval, 'x')

            self.assert_(ctxt.eval("typeof(x) === 'undefined'"))

            self.assert_(ctxt.eval("typeof(String) === 'function'"))

            self.assert_(ctxt.eval("typeof(s.String) === 'undefined'"))

            self.assert_(ctxt.eval("typeof(s.z) === 'undefined'"))

    def testRaiseExceptionInGetter(self):
        class Document(JSClass):
            def __getattr__(self, name):
                if name == 'y':
                    raise TypeError()

                return JSClass.__getattr__(self, name)

        class Global(JSClass):
            def __init__(self):
                self.document = Document()

        with JSContext(Global()) as ctxt:
            self.assertEquals(None, ctxt.eval('document.x'))
            self.assertRaises(TypeError, ctxt.eval, 'document.y')

class TestMultithread(unittest.TestCase):
    def testLocker(self):
        self.assertFalse(JSLocker.active)
        self.assertFalse(JSLocker.locked)

        with JSLocker() as outter_locker:
            self.assertTrue(JSLocker.active)
            self.assertTrue(JSLocker.locked)

            self.assertTrue(outter_locker)

            with JSLocker() as inner_locker:
                self.assertTrue(JSLocker.locked)

                self.assertTrue(outter_locker)
                self.assertTrue(inner_locker)

                with JSUnlocker() as unlocker:
                    self.assertFalse(JSLocker.locked)

                    self.assertTrue(outter_locker)
                    self.assertTrue(inner_locker)

                self.assertTrue(JSLocker.locked)

        self.assertTrue(JSLocker.active)
        self.assertFalse(JSLocker.locked)

        locker = JSLocker()

        with JSContext():
            self.assertRaises(RuntimeError, locker.__enter__)
            self.assertRaises(RuntimeError, locker.__exit__, None, None, None)

        del locker

    def testMultiPythonThread(self):
        import time, threading

        class Global:
            count = 0
            started = threading.Event()
            finished = threading.Semaphore(0)

            def sleep(self, ms):
                time.sleep(ms / 1000.0)

                self.count += 1

        g = Global()

        def run():
            with JSContext(g) as ctxt:
                ctxt.eval("""
                    started.wait();

                    for (i=0; i<10; i++)
                    {
                        sleep(100);
                    }

                    finished.release();
                """)

        threading.Thread(target=run).start()

        now = time.time()

        self.assertEqual(0, g.count)

        g.started.set()
        g.finished.acquire()

        self.assertEqual(10, g.count)

        self.assert_((time.time() - now) >= 1)

    def testMultiJavascriptThread(self):
        import time, threading

        class Global:
            result = []

            def add(self, value):
                with JSUnlocker():
                    time.sleep(0.1)

                    self.result.append(value)

        g = Global()

        def run():
            with JSContext(g) as ctxt:
                ctxt.eval("""
                    for (i=0; i<10; i++)
                        add(i);
                """)

        threads = [threading.Thread(target=run), threading.Thread(target=run)]

        with JSLocker():
            for t in threads: t.start()

        for t in threads: t.join()

        self.assertEqual(20, len(g.result))

    def _testPreemptionJavascriptThreads(self):
        import time, threading

        class Global:
            result = []

            def add(self, value):
                # we use preemption scheduler to switch between threads
                # so, just comment the JSUnlocker
                #
                # with JSUnlocker() as unlocker:
                time.sleep(0.1)

                self.result.append(value)

        g = Global()

        def run():
            with JSContext(g) as ctxt:
                ctxt.eval("""
                    for (i=0; i<10; i++)
                        add(i);
                """)

        threads = [threading.Thread(target=run), threading.Thread(target=run)]

        with JSLocker() as locker:
            JSLocker.startPreemption(100)

            for t in threads: t.start()

        for t in threads: t.join()

        self.assertEqual(20, len(g.result))

class TestEngine(unittest.TestCase):
    def testClassProperties(self):
        with JSContext() as ctxt:
            self.assert_(str(JSEngine.version).startswith("3."))
            self.assertFalse(JSEngine.dead)

    def testCompile(self):
        with JSContext() as ctxt:
            with JSEngine() as engine:
                s = engine.compile("1+2")

                self.assert_(isinstance(s, _PyV8.JSScript))

                self.assertEquals("1+2", s.source)
                self.assertEquals(3, int(s.run()))

                self.assertRaises(SyntaxError, engine.compile, "1+")

    def testPrecompile(self):
        with JSContext() as ctxt:
            with JSEngine() as engine:
                data = engine.precompile("1+2")

                self.assert_(data)
                self.assertEquals(28, len(data))

                s = engine.compile("1+2", precompiled=data)

                self.assert_(isinstance(s, _PyV8.JSScript))

                self.assertEquals("1+2", s.source)
                self.assertEquals(3, int(s.run()))

                self.assertRaises(SyntaxError, engine.precompile, "1+")

    def testUnicodeSource(self):
        class Global(JSClass):
            var = u'测试'

            def __getattr__(self, name):
                if (name.decode('utf-8')) == u'变量':
                    return self.var

                return JSClass.__getattr__(self, name)

        g = Global()

        with JSContext(g) as ctxt:
            with JSEngine() as engine:
                src = u"""
                function 函数() { return 变量.length; }

                函数();
                """

                data = engine.precompile(src)

                self.assert_(data)
                self.assertEquals(48, len(data))

                s = engine.compile(src, precompiled=data)

                self.assert_(isinstance(s, _PyV8.JSScript))

                self.assertEquals(src.encode('utf-8'), s.source)
                self.assertEquals(2, s.run())

                self.assert_(hasattr(ctxt.locals, u'函数'.encode('utf-8')))

                func = getattr(ctxt.locals, u'函数'.encode('utf-8'))

                self.assert_(isinstance(func, _PyV8.JSFunction))

                self.assertEquals(u'函数'.encode('utf-8'), func.name)
                self.assertEquals("", func.resname)
                self.assertEquals(1, func.linenum)
                self.assertEquals(0, func.lineoff)
                self.assertEquals(0, func.coloff)

                setattr(ctxt.locals, u'变量'.encode('utf-8'), u'测试长字符串')

                self.assertEquals(6, func())

    def testExtension(self):
        extSrc = """function hello(name) { return "hello " + name + " from javascript"; }"""
        extJs = JSExtension("hello/javascript", extSrc)

        self.assert_(extJs)
        self.assertEqual("hello/javascript", extJs.name)
        self.assertEqual(extSrc, extJs.source)
        self.assertFalse(extJs.autoEnable)
        self.assertTrue(extJs.registered)

        TestEngine.extJs = extJs

        with JSContext(extensions=['hello/javascript']) as ctxt:
            self.assertEqual("hello flier from javascript", ctxt.eval("hello('flier')"))

        # test the auto enable property

        with JSContext() as ctxt:
            self.assertRaises(ReferenceError, ctxt.eval, "hello('flier')")

        extJs.autoEnable = True
        self.assertTrue(extJs.autoEnable)

        with JSContext() as ctxt:
            self.assertEqual("hello flier from javascript", ctxt.eval("hello('flier')"))

        extJs.autoEnable = False
        self.assertFalse(extJs.autoEnable)

        with JSContext() as ctxt:
            self.assertRaises(ReferenceError, ctxt.eval, "hello('flier')")

    def testNativeExtension(self):
        extSrc = "native function hello();"
        extPy = JSExtension("hello/python", extSrc, lambda func: lambda name: "hello " + name + " from python", register=False)
        self.assert_(extPy)
        self.assertEqual("hello/python", extPy.name)
        self.assertEqual(extSrc, extPy.source)
        self.assertFalse(extPy.autoEnable)
        self.assertFalse(extPy.registered)
        extPy.register()
        self.assertTrue(extPy.registered)

        TestEngine.extPy = extPy

        with JSContext(extensions=['hello/python']) as ctxt:
            self.assertEqual("hello flier from python", ctxt.eval("hello('flier')"))

    def _testSerialize(self):
        data = None

        self.assertFalse(JSContext.entered)

        with JSContext() as ctxt:
            self.assert_(JSContext.entered)

            #ctxt.eval("function hello(name) { return 'hello ' + name; }")

            data = JSEngine.serialize()

        self.assert_(data)
        self.assert_(len(data) > 0)

        self.assertFalse(JSContext.entered)

        #JSEngine.deserialize()

        self.assert_(JSContext.entered)

        self.assertEquals('hello flier', JSContext.current.eval("hello('flier');"))

    def testEval(self):
        with JSContext() as ctxt:
            self.assertEquals(3, int(ctxt.eval("1+2")))

    def testGlobal(self):
        class Global(JSClass):
            version = "1.0"

        with JSContext(Global()) as ctxt:
            vars = ctxt.locals

            # getter
            self.assertEquals(Global.version, str(vars.version))
            self.assertEquals(Global.version, str(ctxt.eval("version")))

            self.assertRaises(ReferenceError, ctxt.eval, "nonexists")

            # setter
            self.assertEquals(2.0, float(ctxt.eval("version = 2.0")))

            self.assertEquals(2.0, float(vars.version))

    def testThis(self):
        class Global(JSClass):
            version = 1.0

        with JSContext(Global()) as ctxt:
            self.assertEquals("[object Global]", str(ctxt.eval("this")))

            self.assertEquals(1.0, float(ctxt.eval("this.version")))

    def testObjectBuildInMethods(self):
        class Global(JSClass):
            version = 1.0

        with JSContext(Global()) as ctxt:
            self.assertEquals("[object Global]", str(ctxt.eval("this.toString()")))
            self.assertEquals("[object Global]", str(ctxt.eval("this.toLocaleString()")))
            self.assertEquals(Global.version, float(ctxt.eval("this.valueOf()").version))

            self.assert_(bool(ctxt.eval("this.hasOwnProperty(\"version\")")))

            self.assertFalse(ctxt.eval("this.hasOwnProperty(\"nonexistent\")"))

    def testPythonWrapper(self):
        class Global(JSClass):
            s = [1, 2, 3]
            d = {'a': {'b': 'c'}, 'd': ['e', 'f']}

        g = Global()

        with JSContext(g) as ctxt:
            ctxt.eval("""
                s[2] = s[1] + 2;
                s[0] = s[1];
                delete s[1];
            """)
            self.assertEquals([2, 4], g.s)
            self.assertEquals('c', ctxt.eval("d.a.b"))
            self.assertEquals(['e', 'f'], ctxt.eval("d.d"))
            ctxt.eval("""
                d.a.q = 4
                delete d.d
            """)
            self.assertEquals(4, g.d['a']['q'])
            self.assertEquals(None, ctxt.eval("d.d"))

    def testMemoryAllocationCallback(self):
        alloc = {}

        def callback(space, action, size):
            alloc[(space, action)] = alloc.setdefault((space, action), 0) + size

        JSEngine.setMemoryAllocationCallback(callback)

        with JSContext() as ctxt:
            self.assertEquals({}, alloc)

            ctxt.eval("var o = new Array(1000);")

            alloc.has_key((JSObjectSpace.Code, JSAllocationAction.alloc))

        JSEngine.setMemoryAllocationCallback(None)

class TestDebug(unittest.TestCase):
    def setUp(self):
        self.engine = JSEngine()

    def tearDown(self):
        del self.engine

    events = []

    def processDebugEvent(self, event):
        try:
            logging.debug("receive debug event: %s", repr(event))

            self.events.append(repr(event))
        except:
            logging.error("fail to process debug event")
            logging.debug(traceback.extract_stack())

    def testEventDispatch(self):
        debugger = JSDebugger()

        self.assert_(not debugger.enabled)

        debugger.onBreak = lambda evt: self.processDebugEvent(evt)
        debugger.onException = lambda evt: self.processDebugEvent(evt)
        debugger.onNewFunction = lambda evt: self.processDebugEvent(evt)
        debugger.onBeforeCompile = lambda evt: self.processDebugEvent(evt)
        debugger.onAfterCompile = lambda evt: self.processDebugEvent(evt)

        with JSContext() as ctxt:
            debugger.enabled = True

            self.assertEquals(3, int(ctxt.eval("function test() { text = \"1+2\"; return eval(text) } test()")))

            debugger.enabled = False

            self.assertRaises(JSError, JSContext.eval, ctxt, "throw 1")

            self.assert_(not debugger.enabled)

        self.assertEquals(4, len(self.events))

class TestProfile(unittest.TestCase):
    def _testStart(self):
        self.assertFalse(profiler.started)

        profiler.start()

        self.assert_(profiler.started)

        profiler.stop()

        self.assertFalse(profiler.started)

    def _testResume(self):
        self.assert_(profiler.paused)

        self.assertEquals(profiler.Modules.cpu, profiler.modules)

        profiler.resume()

        profiler.resume(profiler.Modules.heap)

        # TODO enable profiler with resume
        #self.assertFalse(profiler.paused)


class TestAST(unittest.TestCase):

    class Checker(object):
        def __init__(self, testcase):
            self.testcase = testcase
            self.called = 0

        def __getattr__(self, name):
            return getattr(self.testcase, name)

        def test(self, script):
            with JSContext() as ctxt:
                JSEngine().compile(script).visit(self)

            return self.called

        def onProgram(self, prog):
            self.ast = prog.toAST()
            self.json = json.loads(prog.toJSON())

            for decl in prog.scope.declarations:
                decl.visit(self)

            for stmt in prog.body:
                stmt.visit(self)

        def onBlock(self, block):
            for stmt in block.statements:
                stmt.visit(self)

        def onExpressionStatement(self, stmt):
            stmt.expression.visit(self)

            #print type(stmt.expression), stmt.expression

    def testBlock(self):
        class BlockChecker(TestAST.Checker):
            def onBlock(self, stmt):
                self.called += 1

                self.assertEquals(AST.NodeType.Block, stmt.type)

                self.assert_(stmt.initializerBlock)
                self.assertFalse(stmt.anonymous)

                target = stmt.breakTarget
                self.assert_(target)
                self.assertFalse(target.bound)
                self.assert_(target.unused)
                self.assertFalse(target.linked)

                self.assertEquals(2, len(stmt.statements))

                self.assertEquals(['%InitializeVarGlobal("i", 0);', '%InitializeVarGlobal("j", 0);'], [str(s) for s in stmt.statements])

        checker = BlockChecker(self)
        self.assertEquals(1, checker.test("var i, j;"))
        self.assertEquals("""FUNC
. NAME ""
. INFERRED NAME ""
. DECLS
. . VAR "i"
. . VAR "j"
. BLOCK INIT
. . CALL RUNTIME  InitializeVarGlobal
. . . LITERAL "i"
. . . LITERAL 0
. . CALL RUNTIME  InitializeVarGlobal
. . . LITERAL "j"
. . . LITERAL 0
""", checker.ast)
        self.assertEquals([u'FunctionLiteral', {u'name': u''},
            [u'Declaration', {u'mode': u'VAR'},
                [u'Variable', {u'name': u'i'}]
            ], [u'Declaration', {u'mode':u'VAR'},
                [u'Variable', {u'name': u'j'}]
            ], [u'Block',
                [u'ExpressionStatement', [u'CallRuntime', {u'name': u'InitializeVarGlobal'},
                    [u'Literal', {u'handle':u'i'}],
                    [u'Literal', {u'handle': 0}]]],
                [u'ExpressionStatement', [u'CallRuntime', {u'name': u'InitializeVarGlobal'},
                    [u'Literal', {u'handle': u'j'}],
                    [u'Literal', {u'handle': 0}]]]
            ]
        ], checker.json)

    def testIfStatement(self):
        class IfStatementChecker(TestAST.Checker):
            def onIfStatement(self, stmt):
                self.called += 1

                self.assert_(stmt)
                self.assertEquals(AST.NodeType.IfStatement, stmt.type)

                self.assertEquals(7, stmt.pos)
                stmt.pos = 100
                self.assertEquals(100, stmt.pos)

                self.assert_(stmt.hasThenStatement)
                self.assert_(stmt.hasElseStatement)

                self.assertEquals("((value % 2) == 0)", str(stmt.condition))
                self.assertEquals("{ s = \"even\"; }", str(stmt.thenStatement))
                self.assertEquals("{ s = \"odd\"; }", str(stmt.elseStatement))

                self.assertFalse(stmt.condition.isPropertyName)

        self.assertEquals(1, IfStatementChecker(self).test("var s; if (value % 2 == 0) { s = 'even'; } else { s = 'odd'; }"))

    def testForStatement(self):
        class ForStatementChecker(TestAST.Checker):
            def onForStatement(self, stmt):
                self.called += 1

                self.assertEquals("{ j += i; }", str(stmt.body))

                self.assertEquals("i = 0;", str(stmt.init))
                self.assertEquals("(i < 10)", str(stmt.condition))
                self.assertEquals("(i++);", str(stmt.next))

                target = stmt.continueTarget

                self.assert_(target)
                self.assertFalse(target.bound)
                self.assert_(target.unused)
                self.assertFalse(target.linked)
                self.assertFalse(stmt.fastLoop)

            def onForInStatement(self, stmt):
                self.called += 1

                self.assertEquals("{ out += name; }", str(stmt.body))

                self.assertEquals("name", str(stmt.each))
                self.assertEquals("names", str(stmt.enumerable))

            def onWhileStatement(self, stmt):
                self.called += 1

                self.assertEquals("{ i += 1; }", str(stmt.body))

                self.assertEquals("(i < 10)", str(stmt.condition))

            def onDoWhileStatement(self, stmt):
                self.called += 1

                self.assertEquals("{ i += 1; }", str(stmt.body))

                self.assertEquals("(i < 10)", str(stmt.condition))
                self.assertEquals(253, stmt.conditionPos)

        self.assertEquals(4, ForStatementChecker(self).test("""
            var i, j;

            for (i=0; i<10; i++) { j+=i; }

            var names = new Array();
            var out = '';

            for (name in names) { out += name; }

            while (i<10) { i += 1; }

            do { i += 1; } while (i<10);
        """))

    def testCallStatements(self):
        class CallStatementChecker(TestAST.Checker):
            def onDeclaration(self, decl):
                self.called += 1

                var = decl.proxy

                if var.name == 's':
                    self.assertEquals(AST.VarMode.var, decl.mode)
                    self.assertEquals(None, decl.function)

                    self.assert_(var.isValidLeftHandSide)
                    self.assertFalse(var.isArguments)
                    self.assertFalse(var.isThis)
                elif var.name == 'hello':
                    self.assertEquals(AST.VarMode.var, decl.mode)
                    self.assert_(decl.function)
                    self.assertEquals('(function hello(name) { s = ("Hello " + name); })', str(decl.function))
                elif var.name == 'dog':
                    self.assertEquals(AST.VarMode.var, decl.mode)
                    self.assert_(decl.function)
                    self.assertEquals('(function dog(name) { (this).name = name; })', str(decl.function))

            def onCall(self, expr):
                self.called += 1

                self.assertEquals("hello", str(expr.expression))
                self.assertEquals(['"flier"'], [str(arg) for arg in expr.args])
                self.assertEquals(143, expr.pos)

            def onCallNew(self, expr):
                self.called += 1

                self.assertEquals("dog", str(expr.expression))
                self.assertEquals(['"cat"'], [str(arg) for arg in expr.args])
                self.assertEquals(171, expr.pos)

            def onCallRuntime(self, expr):
                self.called += 1

                self.assertEquals("InitializeVarGlobal", expr.name)
                self.assertEquals(['"s"', '0'], [str(arg) for arg in expr.args])
                self.assertFalse(expr.isJsRuntime)

        self.assertEquals(6,  CallStatementChecker(self).test("""
            var s;
            function hello(name) { s = "Hello " + name; }
            function dog(name) { this.name = name; }
            hello("flier");
            new dog("cat");
        """))

    def testTryStatements(self):
        class TryStatementsChecker(TestAST.Checker):
            def onThrow(self, expr):
                self.called += 1

                self.assertEquals('"abc"', str(expr.exception))
                self.assertEquals(54, expr.pos)

            def onTryCatchStatement(self, stmt):
                self.called += 1

                self.assertEquals("{ throw \"abc\"; }", str(stmt.tryBlock))
                #FIXME self.assertEquals([], stmt.targets)

                stmt.tryBlock.visit(self)

                self.assertEquals("err", str(stmt.variable.name))
                self.assertEquals("{ s = err; }", str(stmt.catchBlock))

            def onTryFinallyStatement(self, stmt):
                self.called += 1

                self.assertEquals("{ throw \"abc\"; }", str(stmt.tryBlock))
                #FIXME self.assertEquals([], stmt.targets)

                self.assertEquals("{ s += \".\"; }", str(stmt.finallyBlock))

        self.assertEquals(3, TryStatementsChecker(self).test("""
            var s;
            try {
                throw "abc";
            }
            catch (err) {
                s = err;
            };

            try {
                throw "abc";
            }
            finally {
                s += ".";
            }
        """))

    def testLiterals(self):
        class LiteralChecker(TestAST.Checker):
            def onCallRuntime(self, expr):
                expr.args[1].visit(self)

            def onLiteral(self, litr):
                self.called += 1

                self.assertFalse(litr.isPropertyName)
                self.assertFalse(litr.isNull)
                self.assertFalse(litr.isTrue)

            def onRegExpLiteral(self, litr):
                self.called += 1

                self.assertEquals("test", litr.pattern)
                self.assertEquals("g", litr.flags)

            def onObjectLiteral(self, litr):
                self.called += 1

                self.assertEquals('constant:"name"="flier",constant:"sex"=true',
                                  ",".join(["%s:%s=%s" % (prop.kind, prop.key, prop.value) for prop in litr.properties]))

            def onArrayLiteral(self, litr):
                self.called += 1

                self.assertEquals('"hello","world",42',
                                  ",".join([str(value) for value in litr.values]))

        self.assertEquals(4, LiteralChecker(self).test("""
            false;
            /test/g;
            var o = { name: 'flier', sex: true };
            var a = ['hello', 'world', 42];
        """))

    def testOperations(self):
        class OperationChecker(TestAST.Checker):
            def onUnaryOperation(self, expr):
                self.called += 1

                self.assertEquals(AST.Op.BIT_NOT, expr.op)
                self.assertEquals("i", expr.expression.name)

                #print "unary", expr

            def onIncrementOperation(self, expr):
                self.fail()

            def onBinaryOperation(self, expr):
                self.called += 1

                self.assertEquals(AST.Op.ADD, expr.op)
                self.assertEquals("i", str(expr.left))
                self.assertEquals("j", str(expr.right))
                self.assertEquals(28, expr.pos)

                #print "bin", expr

            def onAssignment(self, expr):
                self.called += 1

                self.assertEquals(AST.Op.ASSIGN_ADD, expr.op)
                self.assertEquals(AST.Op.ADD, expr.binop)

                self.assertEquals("i", str(expr.target))
                self.assertEquals("1", str(expr.value))
                self.assertEquals(41, expr.pos)

                self.assertEquals("(i + 1)", str(expr.binOperation))

                self.assert_(expr.compound)

            def onCountOperation(self, expr):
                self.called += 1

                self.assertFalse(expr.prefix)
                self.assert_(expr.postfix)

                self.assertEquals(AST.Op.INC, expr.op)
                self.assertEquals(AST.Op.ADD, expr.binop)
                self.assertEquals(55, expr.pos)
                self.assertEquals("i", expr.expression.name)

                #print "count", expr

            def onCompareOperation(self, expr):
                self.called += 1

                if self.called == 4:
                    self.assertEquals(AST.Op.EQ, expr.op)
                    self.assertEquals(68, expr.pos) # i==j
                else:
                    self.assertEquals(AST.Op.EQ_STRICT, expr.op)
                    self.assertEquals(82, expr.pos) # i===j

                self.assertEquals("i", str(expr.left))
                self.assertEquals("j", str(expr.right))

                #print "comp", expr

            def onConditional(self, expr):
                self.called += 1

                self.assertEquals("(i > j)", str(expr.condition))
                self.assertEquals("i", str(expr.thenExpr))
                self.assertEquals("j", str(expr.elseExpr))

                self.assertEquals(112, expr.thenExprPos)
                self.assertEquals(114, expr.elseExprPos)

        self.assertEquals(7, OperationChecker(self).test("""
        var i, j;
        i+j;
        i+=1;
        i++;
        i==j;
        i===j;
        ~i;
        i>j?i:j;
        """))

if __name__ == '__main__':
    if "-v" in sys.argv:
        level = logging.DEBUG
    else:
        level = logging.WARN

    if "-p" in sys.argv:
        sys.argv.remove("-p")
        print "Press any key to continue..."
        raw_input()

    logging.basicConfig(level=level, format='%(asctime)s %(levelname)s %(message)s')

    logging.info("testing PyV8 module %s with V8 v%s", __version__, JSEngine.version)

    unittest.main()
